-- Moving a class in one step (Trevor, 2026-10-26: "a simple move request,
-- and if it's farther than 3 days out, it can be automatic"; a student once
-- had to cancel and book again). move_booking takes a confirmed class of the
-- caller's to a new time with the same checks as request_reschedule
-- (assert_booking_limits, assert_lesson_time: the windows, the days off,
-- the class length). Returns what happened:
--   'moved'      the new time starts 72 hours or more from now and the old
--                class is still more than 24 hours away: the new booking is
--                CONFIRMED at once and the old one CANCELLED ('Moved'), like
--                approve_booking would do. No request alert (the row is never
--                PENDING). The app then moves the calendar event, keeping the
--                Meet link, and sends the "rescheduled" emails.
--   'requested'  otherwise: a PENDING request that replaces the class once
--                Trevor approves it, exactly request_reschedule (inside 24
--                hours of the old class it counts as used if he says so).
-- Trevor runs this in the SQL editor.

create or replace function public.move_booking(
  p_booking_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default null
)
returns table (outcome text, booking_id uuid)
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
  v_auto boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_old from public.bookings where id = p_booking_id and student_id = v_uid for update;
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
  perform private.assert_lesson_time(p_start, p_end, v_uid);

  -- Automatic only with the usual 72 hours' notice for the new time, and
  -- more than a day before the old one (inside that, Trevor decides).
  v_auto := p_start >= now() + interval '72 hours' and v_old_start > now() + interval '24 hours';

  insert into public.session_slots (start_time, end_time, status)
  values (p_start, p_end, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings
    (session_slot_id, student_id, status, is_admin_override, reschedule_of,
     student_timezone, lesson_language, whatsapp)
  values (
    v_slot_id, v_uid, case when v_auto then 'CONFIRMED' else 'PENDING' end, false, p_booking_id,
    coalesce((select name from pg_catalog.pg_timezone_names where name = p_timezone), v_old.student_timezone),
    v_old.lesson_language, v_old.whatsapp
  )
  returning id into v_booking_id;

  if v_auto then
    update public.bookings
    set status = 'CANCELLED', cancelled_at = now(), cancellation_reason = 'Moved'
    where id = p_booking_id;
  end if;

  return query select case when v_auto then 'moved' else 'requested' end, v_booking_id;
end;
$$;

revoke execute on function public.move_booking(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.move_booking(uuid, timestamptz, timestamptz, text) to authenticated;
