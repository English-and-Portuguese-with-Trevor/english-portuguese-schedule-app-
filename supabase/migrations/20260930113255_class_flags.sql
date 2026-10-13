-- Class flags: a student Trevor gave lesson access by hand ('granted' or
-- 'lifetime') can flag one of their classes when something went wrong,
-- picking one of a few set reasons (no notes). Each flag is an admin alert,
-- emailed and pushed like the others. One flag per class; confirmed classes
-- only, from booking until a week after the class ended.

alter table public.bookings
  add column if not exists flag_reason text
  check (flag_reason in ('connection', 'booking', 'other'));

alter table public.admin_alerts drop constraint if exists admin_alerts_kind_check;
alter table public.admin_alerts
  add constraint admin_alerts_kind_check check (kind in ('signup', 'subscriber', 'flag'));
alter table public.admin_alerts
  add column if not exists reason text,
  add column if not exists class_start timestamptz;

create or replace function public.flag_my_class(p_booking_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
begin
  if p_reason is null or p_reason not in ('connection', 'booking', 'other') then
    raise exception 'Please pick a reason.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lesson_access in ('granted', 'lifetime')
  ) then
    raise exception 'Booking not found.';
  end if;

  update public.bookings b
  set flag_reason = p_reason
  from public.session_slots s
  where b.id = p_booking_id
    and s.id = b.session_slot_id
    and b.student_id = auth.uid()
    and b.status = 'CONFIRMED'
    and b.flag_reason is null
    and s.end_time > now() - interval '7 days'
  returning s.start_time into v_start;

  if not found then
    if exists (select 1 from public.bookings where id = p_booking_id and student_id = auth.uid() and flag_reason is not null) then
      raise exception 'You already flagged this class.';
    end if;
    raise exception 'Booking not found.';
  end if;

  insert into public.admin_alerts (kind, user_id, name, email, reason, class_start)
  select 'flag', p.id, p.full_name, p.email, p_reason, v_start
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

revoke execute on function public.flag_my_class(uuid, text) from public, anon;
grant execute on function public.flag_my_class(uuid, text) to authenticated;

-- The same as before, plus each alert's reason and class time.
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
