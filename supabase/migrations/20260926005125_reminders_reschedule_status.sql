-- Reminders, reschedule requests, Google connection status, and the
-- admin's own time zone.

---------------------------------------------------------------------------
-- Columns
---------------------------------------------------------------------------
alter table public.bookings
  -- A reschedule request is a PENDING booking pointing at the lesson it
  -- would replace; the original stays booked until the request is approved.
  add column reschedule_of uuid references public.bookings(id) on delete set null,
  add column reminder_sent_at timestamptz;

create index bookings_reschedule_of_idx on public.bookings (reschedule_of) where reschedule_of is not null;

-- The admin's emails show times in the admin's own zone (kept in sync from
-- their browser). Start from Mountain Time rather than the column default.
update public.profiles set timezone = 'America/Denver' where role = 'admin';

---------------------------------------------------------------------------
-- A shared secret for the server's scheduled job. The value lives only in
-- this table and in Vercel's CRON_SECRET; it is never exposed via the API.
---------------------------------------------------------------------------
create schema if not exists private;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);
revoke all on private.app_settings from public, anon, authenticated;

create or replace function private.check_cron_secret(p_secret text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null
     or not exists (select 1 from private.app_settings where key = 'cron_secret' and value = p_secret) then
    raise exception 'Not allowed';
  end if;
end;
$$;
revoke execute on function private.check_cron_secret(text) from public, anon, authenticated;

---------------------------------------------------------------------------
-- Google connection status, shown on the admin Overview
---------------------------------------------------------------------------
create table public.integration_status (
  service text primary key,
  ok boolean not null,
  message text,
  checked_at timestamptz not null default now()
);
alter table public.integration_status enable row level security;
create policy "integration_status_admin_read" on public.integration_status
  for select using (public.is_admin());
grant select on public.integration_status to authenticated;

create or replace function public.record_integration_status(p_secret text, p_service text, p_ok boolean, p_message text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_cron_secret(p_secret);
  insert into public.integration_status (service, ok, message, checked_at)
  values (p_service, p_ok, left(p_message, 500), now())
  on conflict (service) do update
    set ok = excluded.ok, message = excluded.message, checked_at = excluded.checked_at;
end;
$$;

---------------------------------------------------------------------------
-- Reminders: the daily job claims each confirmed lesson once, 36 hours out
---------------------------------------------------------------------------
create or replace function public.claim_student_reminders(p_secret text)
returns table (
  booking_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  student_name text,
  student_email text,
  student_timezone text,
  meet_link text
)
language sql security definer set search_path = public as $$
  select private.check_cron_secret(p_secret);
  with due as (
    update public.bookings b
    set reminder_sent_at = now()
    from public.session_slots s
    where s.id = b.session_slot_id
      and b.status = 'CONFIRMED'
      and b.reminder_sent_at is null
      and s.start_time > now()
      and s.start_time <= now() + interval '36 hours'
    returning b.id, s.start_time, s.end_time, b.student_id, b.student_timezone, b.meet_link
  )
  select due.id, due.start_time, due.end_time, p.full_name, p.email, due.student_timezone, due.meet_link
  from due join public.profiles p on p.id = due.student_id
  order by due.start_time;
$$;

-- The admin's morning agenda: the next 24 hours of lessons plus every
-- request still waiting for approval.
create or replace function public.admin_agenda(p_secret text)
returns table (
  booking_id uuid,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  student_name text,
  student_email text,
  student_timezone text,
  meet_link text,
  lesson_language text,
  whatsapp text,
  reschedule_from timestamptz
)
language sql security definer set search_path = public as $$
  select private.check_cron_secret(p_secret);
  select b.id, b.status, s.start_time, s.end_time, p.full_name, p.email, b.student_timezone,
         b.meet_link, b.lesson_language, b.whatsapp, os.start_time
  from public.bookings b
  join public.session_slots s on s.id = b.session_slot_id
  join public.profiles p on p.id = b.student_id
  left join public.bookings o on o.id = b.reschedule_of
  left join public.session_slots os on os.id = o.session_slot_id
  where (b.status = 'CONFIRMED' and s.start_time >= now() and s.start_time < now() + interval '24 hours')
     or (b.status = 'PENDING' and s.start_time > now())
  order by s.start_time;
$$;

revoke execute on function public.record_integration_status(text, text, boolean, text) from public;
revoke execute on function public.claim_student_reminders(text) from public;
revoke execute on function public.admin_agenda(text) from public;
-- The scheduled job has no signed-in user; the secret is the guard.
grant execute on function public.record_integration_status(text, text, boolean, text) to anon, authenticated;
grant execute on function public.claim_student_reminders(text) to anon, authenticated;
grant execute on function public.admin_agenda(text) to anon, authenticated;

---------------------------------------------------------------------------
-- The admin's time zone
---------------------------------------------------------------------------
create or replace function public.admin_timezone()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select timezone from public.profiles where role = 'admin' order by created_at limit 1),
    'America/Denver'
  );
$$;
grant execute on function public.admin_timezone() to anon, authenticated;

-- Anyone may record their own browser time zone; unknown names are ignored.
create or replace function public.set_my_timezone(p_timezone text)
returns void
language sql security definer set search_path = public as $$
  update public.profiles
  set timezone = p_timezone
  where id = auth.uid()
    and exists (select 1 from pg_timezone_names where name = p_timezone);
$$;
revoke execute on function public.set_my_timezone(text) from public, anon;
grant execute on function public.set_my_timezone(text) to authenticated;

---------------------------------------------------------------------------
-- Reschedule requests
---------------------------------------------------------------------------
-- The same checks a new booking gets: in the future, inside an active
-- window, on the 15-minute grid, the right length.
create or replace function private.assert_lesson_time(p_start timestamptz, p_end timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_start <= now() then
    raise exception 'That time has already passed.';
  end if;

  if not exists (
    select 1 from public.availability_rules r
    where r.is_active
      and extract(dow from (p_start at time zone r.timezone)) = r.day_of_week
      and (p_start at time zone r.timezone)::date = (p_end at time zone r.timezone)::date
      and (p_start at time zone r.timezone)::time >= r.start_time
      and (p_end at time zone r.timezone)::time <= r.end_time
      and p_end - p_start = make_interval(mins => r.slot_duration_minutes)
      and mod(extract(epoch from ((p_start at time zone r.timezone)::time - r.start_time))::int, 900) = 0
  ) then
    raise exception 'That slot is no longer available.';
  end if;
end;
$$;
revoke execute on function private.assert_lesson_time(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.request_reschedule(
  p_booking_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old public.bookings;
  v_old_start timestamptz;
  v_slot_id uuid;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_old from public.bookings where id = p_booking_id and student_id = v_uid;
  if v_old.id is null or v_old.status <> 'CONFIRMED' then
    raise exception 'Only a confirmed lesson can be rescheduled.';
  end if;

  select start_time into v_old_start from public.session_slots where id = v_old.session_slot_id;
  if v_old_start <= now() then
    raise exception 'This lesson has already started.';
  end if;

  if exists (select 1 from public.bookings where reschedule_of = p_booking_id and status = 'PENDING') then
    raise exception 'You already asked to reschedule this lesson.';
  end if;

  perform private.assert_lesson_time(p_start, p_end);

  insert into public.session_slots (start_time, end_time, status)
  values (p_start, p_end, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings
    (session_slot_id, student_id, status, is_admin_override, reschedule_of,
     student_timezone, lesson_language, whatsapp)
  values (
    v_slot_id, v_uid, 'PENDING', false, p_booking_id,
    coalesce((select name from pg_timezone_names where name = p_timezone), v_old.student_timezone),
    v_old.lesson_language, v_old.whatsapp
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;
revoke execute on function public.request_reschedule(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.request_reschedule(uuid, timestamptz, timestamptz, text) to authenticated;

-- Cancelling a lesson also withdraws any reschedule request for it.
create or replace function public.cancel_pending_reschedules()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'CANCELLED' and old.status <> 'CANCELLED' then
    update public.bookings
    set status = 'CANCELLED', cancelled_at = now(), cancellation_reason = 'Original lesson cancelled'
    where reschedule_of = new.id and status = 'PENDING';
  end if;
  return new;
end;
$$;
revoke execute on function public.cancel_pending_reschedules() from public, anon, authenticated;

create trigger trg_cancel_pending_reschedules
  after update of status on public.bookings
  for each row execute function public.cancel_pending_reschedules();
