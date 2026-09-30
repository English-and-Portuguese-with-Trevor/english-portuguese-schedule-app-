-- Flags wait a minute before they're pushed, so a student who flags and
-- takes it back (or flags again) doesn't send a string of notifications: a
-- flag removed within the minute is never pushed. claim_alert_pushes skips
-- flags younger than a minute, and a pg_cron job asks the schedule app to
-- push once a minute while a flag has waited long enough.

create extension if not exists pg_cron;

create or replace function public.claim_alert_pushes(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerts jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with claimed as (
    update public.admin_alerts
    set pushed_at = now()
    where pushed_at is null
      and created_at > now() - interval '2 days'
      and not (kind = 'flag' and created_at > now() - interval '1 minute')
    returning id, kind, name, email, reason, class_start, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_alerts
  from claimed;

  return jsonb_build_object(
    'alerts', v_alerts,
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

-- Run by pg_cron every minute: asks for a push when a flag has waited a minute.
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
    where kind = 'flag' and pushed_at is null
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

revoke execute on function private.push_waiting_flags() from public, anon, authenticated;

select cron.schedule('push-waiting-flags', '* * * * *', 'select private.push_waiting_flags()');
