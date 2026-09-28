-- Two limits on what a student can hold at once: a class can be booked up to
-- 60 days ahead, and a student can have at most 10 upcoming classes (pending
-- or confirmed, including reschedule requests). Both checks live in
-- private.assert_booking_limits and run for new bookings and reschedules.

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
end;
$$;
revoke execute on function private.assert_booking_limits(uuid, timestamptz) from public, anon, authenticated;

-- Same as 20260925221751_booking_questions.sql plus the limits.
create or replace function public.request_individual_booking(
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default null,
  p_language text default null,
  p_whatsapp text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slot_id uuid;
  v_booking_id uuid;
  v_whatsapp text := nullif(trim(p_whatsapp), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_language is not null and p_language not in ('ENGLISH', 'PORTUGUESE') then
    raise exception 'Please choose English or Portuguese.';
  end if;

  if v_whatsapp is not null and v_whatsapp !~ '^\+?[0-9 ()./-]{6,25}$' then
    raise exception 'Please enter a valid WhatsApp number.';
  end if;

  if p_start <= now() then
    raise exception 'That time has already passed.';
  end if;

  perform private.assert_booking_limits(v_uid, p_start);

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

  insert into public.session_slots (start_time, end_time, status)
  values (p_start, p_end, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings
    (session_slot_id, student_id, status, is_admin_override, student_timezone, lesson_language, whatsapp)
  values (
    v_slot_id,
    v_uid,
    case when p_start >= now() + interval '72 hours' then 'CONFIRMED' else 'PENDING' end,
    false,
    -- Only keep names Postgres recognizes, e.g. 'America/Sao_Paulo'.
    (select name from pg_catalog.pg_timezone_names where name = p_timezone),
    p_language,
    v_whatsapp
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- Same as 20260926005125_reminders_reschedule_status.sql plus the limits.
create or replace function public.request_reschedule(
  p_booking_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  perform private.assert_booking_limits(v_uid, p_start);
  perform private.assert_lesson_time(p_start, p_end);

  insert into public.session_slots (start_time, end_time, status)
  values (p_start, p_end, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings
    (session_slot_id, student_id, status, is_admin_override, reschedule_of,
     student_timezone, lesson_language, whatsapp)
  values (
    v_slot_id, v_uid, 'PENDING', false, p_booking_id,
    coalesce((select name from pg_catalog.pg_timezone_names where name = p_timezone), v_old.student_timezone),
    v_old.lesson_language, v_old.whatsapp
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;
