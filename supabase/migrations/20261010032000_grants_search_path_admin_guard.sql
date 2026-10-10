-- Security audit (2026-10-10), the database side.

-- 1. anon and authenticated held TRUNCATE, TRIGGER and REFERENCES on 18
-- tables, left over from "grant all" followed by revoking only the data
-- privileges. Row-level security does not cover TRUNCATE.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
  end loop;
end;
$$;

-- 2. The remaining security-definer functions that still searched public:
-- the same bodies with an empty search path, every name schema-qualified.
create or replace function private.check_cron_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null
     or not exists (select 1 from private.app_settings where key = 'cron_secret' and value = p_secret) then
    raise exception 'Not allowed';
  end if;
end;
$$;

create or replace function public.admin_timezone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select timezone from public.profiles where role = 'admin' order by created_at limit 1),
    'America/Denver'
  );
$$;

create or replace function public.set_my_timezone(p_timezone text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set timezone = p_timezone
  where id = auth.uid()
    and exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone);
$$;

create or replace function public.record_integration_status(p_secret text, p_service text, p_ok boolean, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  insert into public.integration_status (service, ok, message, checked_at)
  values (p_service, p_ok, left(p_message, 500), now())
  on conflict (service) do update
    set ok = excluded.ok, message = excluded.message, checked_at = excluded.checked_at;
end;
$$;

create or replace function public.release_cancelled_individual_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'CANCELLED' and old.status <> 'CANCELLED' then
    update public.session_slots
    set status = 'CANCELLED'
    where id = new.session_slot_id;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''), 100),
    'student'
  )
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

create or replace function private.assert_lesson_time(p_start timestamptz, p_end timestamptz, p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
      and p_end - p_start = make_interval(mins => private.class_minutes(p_student, r.slot_duration_minutes))
      and mod(extract(epoch from ((p_start at time zone r.timezone)::time - r.start_time))::int, 900) = 0
      and not exists (
        select 1 from public.availability_blocks b
        where (p_start at time zone r.timezone)::date between b.starts_on and b.ends_on
      )
  ) then
    raise exception 'That slot is no longer available.';
  end if;
end;
$$;

create or replace function public.admin_agenda(p_secret text)
returns table (
  booking_id uuid, status text, start_time timestamptz, end_time timestamptz,
  student_name text, student_email text, student_timezone text, meet_link text,
  lesson_language text, whatsapp text, reschedule_from timestamptz
)
language sql
security definer
set search_path = ''
as $$
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

create or replace function public.claim_student_reminders(p_secret text)
returns table (
  booking_id uuid, start_time timestamptz, end_time timestamptz,
  student_name text, student_email text, student_timezone text, meet_link text
)
language sql
security definer
set search_path = ''
as $$
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

-- 3. Roles: never the last admin, never your own (the dashboard checked
-- this in the browser only).
create or replace function private.guard_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    if old.id = auth.uid() then
      raise exception 'You can''t take away your own admin role.';
    end if;
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'The last admin can''t be demoted.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_admin_role() from public, anon, authenticated;
drop trigger if exists profiles_guard_admin_role on public.profiles;
create trigger profiles_guard_admin_role
  before update of role on public.profiles
  for each row execute function private.guard_admin_role();

-- 4. Starting a note as an admin goes through is_admin() (the Authenticator
-- code), like every other admin right, instead of the bare role column.
drop policy "Private students add their own notes" on public.student_notes;
create policy "Private students add their own notes" on public.student_notes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (
      private.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and (p.class_package is not null or p.notes_access)
      )
    )
    and (parent_id is null or private.owns_note(parent_id))
  );
