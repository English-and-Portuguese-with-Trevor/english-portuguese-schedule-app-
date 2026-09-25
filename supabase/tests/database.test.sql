-- Database security and booking-rule tests.
--
-- These check the rules that actually protect the data: row-level security,
-- the booking functions (request_individual_booking, cancel_my_booking),
-- and the overlap and one-booking-per-slot constraints. The app's own
-- checks can be bypassed by calling the API directly, so these are the ones
-- that matter.
--
-- Safe to run against production: everything runs in one transaction that
-- is rolled back at the end, including the throwaway test users. Existing
-- availability windows are deactivated *inside* that transaction so real
-- hours can't interfere; the rollback restores them.
--
-- Run it by pasting the whole file into the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f supabase/tests/database.test.sql
-- Success: no error, and the final row says ALL DATABASE TESTS PASSED.
-- Failure: an error naming the check that failed.

begin;

do $$
declare
  v_student uuid := gen_random_uuid();
  v_other   uuid := gen_random_uuid();
  v_admin   uuid := gen_random_uuid();
  v_sat     date;
  v_booking uuid;
  v_pending uuid;
  v_late    uuid;
  v_soon    timestamptz;
  v_count   int;
  v_text    text;
  v_failed  boolean;
  v_msg     text;

  -- Saturday windows used below, 10 AM–noon Mountain Time.
  v_10    timestamptz;
  v_1015  timestamptz;
  v_11    timestamptz;
  v_1105  timestamptz;
  v_1115  timestamptz;
  v_12    timestamptz;
  v_1215  timestamptz;
begin
  ---------------------------------------------------------------------------
  -- Fixtures (as the database owner)
  ---------------------------------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (v_student, 'db-test-student@example.com', '{"full_name":"Test Student"}', 'authenticated', 'authenticated'),
    (v_other,   'db-test-other@example.com',   '{"full_name":"Other Student"}', 'authenticated', 'authenticated'),
    (v_admin,   'db-test-admin@example.com',   '{"full_name":"Test Admin"}',   'authenticated', 'authenticated');

  if (select count(*) from public.profiles where id in (v_student, v_other, v_admin) and role = 'student') <> 3 then
    raise exception 'FAIL: new sign-ups get a student profile automatically';
  end if;
  update public.profiles set role = 'admin' where id = v_admin;

  update public.availability_rules set is_active = false;
  insert into public.availability_rules (day_of_week, start_time, end_time, slot_duration_minutes, timezone, created_by)
  values (6, '10:00', '12:00', 60, 'America/Denver', v_admin);

  -- A window tomorrow (or the day after, if tomorrow is Saturday): less than
  -- 72 hours away, so requests there need approval.
  v_sat := (now() at time zone 'America/Denver')::date + 1;
  if extract(dow from v_sat) = 6 then v_sat := v_sat + 1; end if;
  insert into public.availability_rules (day_of_week, start_time, end_time, slot_duration_minutes, timezone, created_by)
  values (extract(dow from v_sat)::int, '00:00', '23:00', 60, 'America/Denver', v_admin);
  v_soon := (v_sat + time '12:00') at time zone 'America/Denver';

  -- The first Saturday at least 5 days out, so it's more than 72 hours away.
  v_sat := (now() at time zone 'America/Denver')::date + 5;
  v_sat := v_sat + ((6 - extract(dow from v_sat)::int + 7) % 7);
  v_10   := (v_sat + time '10:00') at time zone 'America/Denver';
  v_1015 := (v_sat + time '10:15') at time zone 'America/Denver';
  v_11   := (v_sat + time '11:00') at time zone 'America/Denver';
  v_1105 := (v_sat + time '11:05') at time zone 'America/Denver';
  v_1115 := (v_sat + time '11:15') at time zone 'America/Denver';
  v_12   := (v_sat + time '12:00') at time zone 'America/Denver';
  v_1215 := (v_sat + time '12:15') at time zone 'America/Denver';

  -- A confirmed session starting in 2 hours, for the late-cancellation check.
  insert into public.session_slots (start_time, end_time, status)
  values (now() + interval '2 hours', now() + interval '3 hours', 'OPEN');
  insert into public.bookings (session_slot_id, student_id, status)
  values ((select id from public.session_slots where start_time = now() + interval '2 hours'), v_student, 'CONFIRMED')
  returning id into v_late;

  ---------------------------------------------------------------------------
  -- As a student
  ---------------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 72 hours or more away: confirmed right away (not as an admin override).
  v_booking := public.request_individual_booking(v_10, v_11, 'America/Sao_Paulo', 'PORTUGUESE', '+1 540 623 8596');
  if (select lesson_language || ' ' || whatsapp from public.bookings where id = v_booking) is distinct from 'PORTUGUESE +1 540 623 8596' then
    raise exception 'FAIL: booking question answers are saved';
  end if;
  if (select student_timezone from public.bookings where id = v_booking) is distinct from 'America/Sao_Paulo' then
    raise exception 'FAIL: the student''s time zone is saved with the booking';
  end if;
  select status || '/' || is_admin_override::text || '/' || (student_id = v_student)::text
    into v_text from public.bookings where id = v_booking;
  if v_text is distinct from 'CONFIRMED/false/true' then
    raise exception 'FAIL: a booking 72+ hours out is confirmed, not an override, and theirs (got %)', v_text;
  end if;

  -- The server records the lesson's Meet link once; it can't be overwritten.
  perform public.set_booking_meeting(v_booking, 'evt-1', 'https://meet.google.com/aaa');
  perform public.set_booking_meeting(v_booking, 'evt-2', 'https://evil.example');
  select google_event_id || ' ' || meet_link into v_text from public.bookings where id = v_booking;
  if v_text is distinct from 'evt-1 https://meet.google.com/aaa' then
    raise exception 'FAIL: a booking''s meeting is recorded once and never overwritten (got %)', v_text;
  end if;

  -- Less than 72 hours away: allowed, but pending approval.
  v_pending := public.request_individual_booking(v_soon, v_soon + interval '1 hour');
  if (select status from public.bookings where id = v_pending) <> 'PENDING' then
    raise exception 'FAIL: a booking under 72 hours out is pending approval';
  end if;

  -- Overlapping an existing session is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_1015, v_1115);
  exception when others then v_failed := true; v_msg := sqlstate;
  end;
  if not v_failed or v_msg <> '23P01' then
    raise exception 'FAIL: a request overlapping another session is refused (sqlstate %)', v_msg;
  end if;

  -- Back-to-back with an existing session is fine. An unknown time zone is dropped.
  perform public.request_individual_booking(v_11, v_12, 'Not/AZone');
  if (select student_timezone from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where s.start_time = v_11 and b.status <> 'CANCELLED') is not null then
    raise exception 'FAIL: an unrecognized time zone is not saved';
  end if;

  -- A session that would run past the window's end is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_1115, v_1215);
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%no longer available%' then
    raise exception 'FAIL: a session running past the window end is refused (%)', v_msg;
  end if;

  -- Booking answers are checked.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_10 + interval '7 days', v_11 + interval '7 days', null, 'SPANISH', null);
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%English or Portuguese%' then
    raise exception 'FAIL: only English or Portuguese lessons can be requested (%)', v_msg;
  end if;
  v_failed := false;
  begin
    perform public.request_individual_booking(v_10 + interval '7 days', v_11 + interval '7 days', null, 'ENGLISH', 'call me maybe');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%WhatsApp%' then
    raise exception 'FAIL: a WhatsApp number must look like a phone number (%)', v_msg;
  end if;

  -- A start off the 15-minute grid is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_1105, v_1105 + interval '1 hour');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%no longer available%' then
    raise exception 'FAIL: a start off the 15-minute grid is refused (%)', v_msg;
  end if;

  -- A session of the wrong length is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_10 + interval '7 days', v_10 + interval '7 days 30 minutes');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%no longer available%' then
    raise exception 'FAIL: a session of the wrong length is refused (%)', v_msg;
  end if;

  -- A time that has already started is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_soon - interval '7 days', v_soon - interval '7 days' + interval '1 hour');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%already passed%' then
    raise exception 'FAIL: past times are refused (%)', v_msg;
  end if;

  -- Students cannot write slots, bookings, or availability directly.
  v_failed := false;
  begin
    insert into public.session_slots (start_time, end_time, status)
    values (v_10 + interval '7 days', v_11 + interval '7 days', 'OPEN');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: students cannot insert session slots directly'; end if;

  v_failed := false;
  begin
    insert into public.bookings (session_slot_id, student_id, status, is_admin_override)
    values ((select session_slot_id from public.bookings where id = v_booking), v_student, 'CONFIRMED', true);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: students cannot insert bookings directly'; end if;

  v_failed := false;
  begin
    insert into public.availability_rules (day_of_week, start_time, end_time, created_by)
    values (0, '00:00', '23:00', v_student);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: students cannot add availability'; end if;

  -- Students cannot approve their own pending request.
  update public.bookings set status = 'CONFIRMED' where id = v_pending;
  if (select status from public.bookings where id = v_pending) <> 'PENDING' then
    raise exception 'FAIL: students cannot confirm their own booking';
  end if;

  -- Students cannot promote themselves to admin.
  update public.profiles set role = 'admin' where id = v_student;
  if (select role from public.profiles where id = v_student) <> 'student' then
    raise exception 'FAIL: students cannot make themselves admin';
  end if;

  ---------------------------------------------------------------------------
  -- As a different student
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.bookings where student_id = v_student;
  if v_count <> 0 then raise exception 'FAIL: students cannot see other students'' bookings'; end if;

  v_failed := false;
  begin
    perform public.cancel_my_booking(v_booking);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: students cannot cancel someone else''s booking'; end if;

  perform public.set_booking_meeting(v_pending, 'evt-x', 'https://evil.example');
  reset role;
  if (select meet_link from public.bookings where id = v_pending) is not null then
    raise exception 'FAIL: students cannot set a meeting link on someone else''s booking';
  end if;
  set local role authenticated;

  ---------------------------------------------------------------------------
  -- Back as the first student: cancelling frees the time
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.cancel_my_booking(v_booking);
  if (select late_cancellation from public.bookings where id = v_booking) then
    raise exception 'FAIL: cancelling with 24+ hours notice is not a late cancellation';
  end if;

  -- Cancelling a confirmed session under 24 hours out is flagged as late.
  perform public.cancel_my_booking(v_late);
  if not (select late_cancellation from public.bookings where id = v_late) then
    raise exception 'FAIL: cancelling under 24 hours before a confirmed session is a late cancellation';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  perform public.request_individual_booking(v_10, v_11);

  ---------------------------------------------------------------------------
  -- As an admin
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  update public.bookings set status = 'CONFIRMED' where id = v_pending;
  if (select status from public.bookings where id = v_pending) <> 'CONFIRMED' then
    raise exception 'FAIL: admins can approve a pending booking';
  end if;

  -- A session holds one student: even an admin can't add a second booking.
  v_failed := false;
  begin
    insert into public.bookings (session_slot_id, student_id, status, is_admin_override)
    values ((select session_slot_id from public.bookings where id = v_pending), v_admin, 'CONFIRMED', true);
  exception when others then v_failed := true; v_msg := sqlstate;
  end;
  if not v_failed or v_msg <> '23505' then
    raise exception 'FAIL: a session can only hold one active booking (sqlstate %)', v_msg;
  end if;

  -- An admin cancelling never marks it as the student's late cancellation.
  update public.bookings set status = 'CANCELLED', cancelled_at = now() where id = v_pending;
  if (select late_cancellation from public.bookings where id = v_pending) then
    raise exception 'FAIL: admin cancellations are not late cancellations';
  end if;

  select count(*) into v_count from public.bookings where student_id in (v_student, v_other);
  if v_count < 3 then raise exception 'FAIL: admins can see every student''s bookings (saw %)', v_count; end if;

  ---------------------------------------------------------------------------
  -- Signed out
  ---------------------------------------------------------------------------
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '', true);

  v_failed := false;
  begin
    perform public.request_individual_booking(v_10 + interval '7 days', v_11 + interval '7 days');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: signed-out visitors cannot book'; end if;

  reset role;
end;
$$;

select 'ALL DATABASE TESTS PASSED' as result;

rollback;
