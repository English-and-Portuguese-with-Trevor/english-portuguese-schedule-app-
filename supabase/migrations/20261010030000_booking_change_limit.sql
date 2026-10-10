-- Security audit (2026-10-10): any logged-in student could loop
-- book-inside-72-hours / cancel, and each round pushed Trevor's devices at
-- once and sent him two emails; a few hundred rounds would use up the day's
-- Gmail sending quota, so every real email that day would fail. The 10-class
-- cap only counted classes still booked, so it never bit.
--
-- Two brakes: a student may create at most 8 bookings in 24 hours, cancelled
-- ones included (requests and reschedules both make a booking row), and a
-- 'request' alert waits a minute before it is pushed, like flags and reports,
-- so a request taken straight back is never pushed at all.

create or replace function private.assert_booking_limits(p_student uuid, p_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_start > now() + interval '60 days' then
    raise exception 'Classes can be booked up to 60 days ahead.';
  end if;

  if (
    select count(*)
    from public.bookings b
    join public.session_slots s on s.id = b.session_slot_id
    where b.student_id = p_student
      and b.status <> 'CANCELLED'
      and s.end_time > now()
  ) >= 10 then
    raise exception 'You already have 10 upcoming classes. Cancel one to book another.';
  end if;

  if (
    select count(*)
    from public.bookings b
    where b.student_id = p_student
      and not b.is_admin_override
      and b.created_at > now() - interval '24 hours'
  ) >= 8 then
    raise exception 'That''s a lot of booking changes for one day. Please try again tomorrow or write to Trevor.';
  end if;
end;
$$;

-- Pushes: a request waits a minute like a flag or a report.
create or replace function public.claim_alert_pushes(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerts jsonb;
  v_emails jsonb;
begin
  perform private.check_cron_secret(p_secret);
  with claimed as (
    update public.admin_alerts
    set pushed_at = now()
    where pushed_at is null
      and created_at > now() - interval '2 days'
      and not (kind in ('flag', 'report', 'request') and created_at > now() - interval '1 minute')
    returning id, kind, name, email, reason, class_start, item, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_alerts from claimed;
  with claimed as (
    update public.admin_alerts
    set emailed_at = now()
    where emailed_at is null
      and kind not in ('flag', 'report')
      and created_at > now() - interval '14 days'
    returning id, kind, name, email, reason, class_start, item, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_emails from claimed;
  return jsonb_build_object(
    'alerts', v_alerts,
    'emails', v_emails,
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s
      join public.profiles p on p.id = s.user_id and p.role = 'admin'
    ), '[]'::jsonb),
    'vapid_public_key', (select value from private.app_settings where key = 'vapid_public_key'),
    'vapid_private_key', (select value from private.app_settings where key = 'vapid_private_key')
  );
end;
$$;

create or replace function private.push_waiting_flags()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if not exists (
    select 1 from public.admin_alerts
    where kind in ('flag', 'report', 'request') and pushed_at is null
      and created_at <= now() - interval '1 minute'
      and created_at > now() - interval '2 days'
  ) then
    return;
  end if;
  select value into v_secret from private.app_settings where key = 'cron_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://schedule.englishandportuguesewithtrevor.com/api/alerts/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;
