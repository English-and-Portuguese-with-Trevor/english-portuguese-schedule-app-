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
  v_busy    uuid := gen_random_uuid();
  v_admin   uuid := gen_random_uuid();
  v_sat     date;
  v_booking uuid;
  v_pending uuid;
  v_late    uuid;
  v_started uuid;
  v_slot    uuid;
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
    (v_busy,    'db-test-busy@example.com',    '{"full_name":"Busy Student"}',  'authenticated', 'authenticated'),
    (v_admin,   'db-test-admin@example.com',   '{"full_name":"Test Admin"}',   'authenticated', 'authenticated');

  if (select count(*) from public.profiles where id in (v_student, v_other, v_busy, v_admin) and role = 'student') <> 4 then
    raise exception 'FAIL: new sign-ups get a student profile automatically';
  end if;
  update public.profiles set role = 'admin' where id = v_admin;
  -- The job secret the server uses to record Meet links (rolled back with the rest).
  insert into private.app_settings (key, value) values ('cron_secret', 'test-secret')
    on conflict (key) do update set value = excluded.value;

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

  -- A confirmed class that started half an hour ago: too late to cancel.
  insert into public.session_slots (start_time, end_time, status)
  values (now() - interval '30 minutes', now() + interval '30 minutes', 'OPEN')
  returning id into v_slot;
  insert into public.bookings (session_slot_id, student_id, status)
  values (v_slot, v_student, 'CONFIRMED')
  returning id into v_started;

  -- A student who already holds 10 upcoming classes (a month out, back to back).
  for i in 1..10 loop
    insert into public.session_slots (start_time, end_time, status)
    values (now() + interval '30 days' + make_interval(hours => i), now() + interval '30 days' + make_interval(hours => i + 1), 'OPEN')
    returning id into v_slot;
    insert into public.bookings (session_slot_id, student_id, status) values (v_slot, v_busy, 'CONFIRMED');
  end loop;

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

  -- Only the server, with the job secret, records the lesson's Meet link; a
  -- student's session can't, and it's recorded once and never overwritten.
  v_failed := false;
  begin
    perform public.set_booking_meeting(v_booking, 'evt-0', 'https://meet.google.com/aaa', 'wrong-secret');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: recording a Meet link needs the job secret'; end if;
  if (select google_event_id from public.bookings where id = v_booking) is not null then
    raise exception 'FAIL: a call without the job secret must not record a Meet link';
  end if;
  perform public.set_booking_meeting(v_booking, 'evt-1', 'https://meet.google.com/aaa', 'test-secret');
  perform public.set_booking_meeting(v_booking, 'evt-2', 'https://meet.google.com/bbb', 'test-secret');
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

  -- More than 60 days ahead is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_10 + interval '70 days', v_11 + interval '70 days');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%60 days%' then
    raise exception 'FAIL: classes more than 60 days ahead are refused (%)', v_msg;
  end if;

  -- A class that has already started can't be canceled.
  v_failed := false;
  begin
    perform public.cancel_my_booking(v_started);
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%already started%' then
    raise exception 'FAIL: a class that has started can''t be canceled (%)', v_msg;
  end if;
  if (select status from public.bookings where id = v_started) <> 'CONFIRMED' then
    raise exception 'FAIL: a class that has started stays booked';
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

  v_failed := false;
  begin
    perform public.set_booking_meeting(v_pending, 'evt-x', 'https://evil.example', 'test-secret');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: only Google Meet links can be recorded'; end if;
  reset role;
  if (select meet_link from public.bookings where id = v_pending) is not null then
    raise exception 'FAIL: a link that isn''t Google Meet is never recorded';
  end if;
  set local role authenticated;

  ---------------------------------------------------------------------------
  -- Back as the first student: canceling frees the time
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.cancel_my_booking(v_booking);
  if (select late_cancellation from public.bookings where id = v_booking) then
    raise exception 'FAIL: canceling with 24+ hours notice is not a late cancellation';
  end if;

  -- Canceling a confirmed session under 24 hours out is flagged as late.
  perform public.cancel_my_booking(v_late);
  if not (select late_cancellation from public.bookings where id = v_late) then
    raise exception 'FAIL: canceling under 24 hours before a confirmed session is a late cancellation';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  perform public.request_individual_booking(v_10, v_11);

  ---------------------------------------------------------------------------
  -- As a student with 10 upcoming classes: no more until one is canceled
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_busy, 'role', 'authenticated')::text, true);
  v_failed := false;
  begin
    perform public.request_individual_booking(v_10 + interval '14 days', v_11 + interval '14 days');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%10 upcoming classes%' then
    raise exception 'FAIL: a student with 10 upcoming classes can''t book another (%)', v_msg;
  end if;

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

  -- An admin canceling never marks it as the student's late cancellation.
  update public.bookings set status = 'CANCELLED', cancelled_at = now() where id = v_pending;
  if (select late_cancellation from public.bookings where id = v_pending) then
    raise exception 'FAIL: admin cancellations are not late cancellations';
  end if;

  select count(*) into v_count from public.bookings where student_id in (v_student, v_other);
  if v_count < 4 then raise exception 'FAIL: admins can see every student''s bookings (saw %)', v_count; end if;

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


-- Reminders, the admin agenda, Google status, time zones, and reschedules.
-- (Overwrites the job secret with a test value; the rollback restores it.)
do $$
declare
  v_s uuid := gen_random_uuid(); v_o uuid := gen_random_uuid(); v_a uuid := gen_random_uuid();
  v_sat date; v_b uuid; v_r uuid; v_near uuid; v_far uuid; v_n int; v_ok boolean; v_msg text;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (v_s, 'db-test-student2@example.com', '{"full_name":"T S"}', 'authenticated', 'authenticated'),
    (v_o, 'db-test-other2@example.com', '{"full_name":"T O"}', 'authenticated', 'authenticated'),
    (v_a, 'db-test-admin2@example.com', '{"full_name":"T A"}', 'authenticated', 'authenticated');
  update public.profiles set role = 'admin' where id = v_a;
  insert into private.app_settings (key, value) values ('cron_secret', 'test-secret')
    on conflict (key) do update set value = excluded.value;
  update public.availability_rules set is_active = false;
  insert into public.availability_rules (day_of_week, start_time, end_time, slot_duration_minutes, timezone, created_by)
  values (6, '08:00', '12:00', 60, 'America/Denver', v_a);
  v_sat := (now() at time zone 'America/Denver')::date + 5;
  v_sat := v_sat + ((6 - extract(dow from v_sat)::int + 7) % 7) + 7; -- a week after the checks above

  -- Reminder fixtures: confirmed lessons 30h and 40h out
  insert into public.session_slots (start_time, end_time, status) values (now() + interval '30 hours', now() + interval '31 hours', 'OPEN');
  insert into public.bookings (session_slot_id, student_id, status)
    values ((select id from public.session_slots where start_time = now() + interval '30 hours'), v_s, 'CONFIRMED') returning id into v_near;
  insert into public.session_slots (start_time, end_time, status) values (now() + interval '40 hours', now() + interval '41 hours', 'OPEN');
  insert into public.bookings (session_slot_id, student_id, status)
    values ((select id from public.session_slots where start_time = now() + interval '40 hours'), v_s, 'CONFIRMED') returning id into v_far;

  set local role anon;
  v_ok := false; begin perform * from public.claim_student_reminders('wrong'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: reminders need the secret'; end if;
  select count(*) into v_n from public.claim_student_reminders('test-secret') where booking_id in (v_near, v_far);
  if v_n <> 1 then raise exception 'FAIL: only the lesson within 36h is reminded (got %)', v_n; end if;
  select count(*) into v_n from public.claim_student_reminders('test-secret') where booking_id in (v_near, v_far);
  if v_n <> 0 then raise exception 'FAIL: each lesson is reminded once (got %)', v_n; end if;
  select count(*) into v_n from public.admin_agenda('test-secret') where booking_id = v_near;
  if v_n <> 0 then raise exception 'FAIL: agenda covers only the next 24h of confirmed lessons'; end if;
  perform public.record_integration_status('test-secret', 'google', false, 'token revoked');
  v_ok := false; begin perform public.record_integration_status('wrong', 'google', true, null); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: status needs the secret'; end if;
  if public.admin_timezone() is null then raise exception 'FAIL: admin tz'; end if;
  reset role;
  if (select ok from public.integration_status where service = 'google') then raise exception 'FAIL: status recorded'; end if;
  v_ok := false; begin set local role anon; perform count(*) from private.app_settings; exception when others then v_ok := true; end;
  reset role;
  if not v_ok then raise exception 'FAIL: the secret table is not readable via the API roles'; end if;

  -- Reschedule
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  perform public.set_my_timezone('Europe/Lisbon');
  perform public.set_my_timezone('Not/AZone');
  v_b := public.request_individual_booking((v_sat + time '08:00') at time zone 'America/Denver', (v_sat + time '09:00') at time zone 'America/Denver', 'America/Denver', 'ENGLISH', null);
  v_r := public.request_reschedule(v_b, (v_sat + time '10:00') at time zone 'America/Denver', (v_sat + time '11:00') at time zone 'America/Denver', 'America/Sao_Paulo');
  if (select status || ' ' || reschedule_of::text || ' ' || lesson_language || ' ' || student_timezone from public.bookings where id = v_r)
     is distinct from 'PENDING ' || v_b::text || ' ENGLISH America/Sao_Paulo' then raise exception 'FAIL: reschedule request is pending and linked'; end if;
  if (select status from public.bookings where id = v_b) <> 'CONFIRMED' then raise exception 'FAIL: original stays booked'; end if;
  v_ok := false; begin perform public.request_reschedule(v_b, (v_sat + time '11:00') at time zone 'America/Denver', (v_sat + time '12:00') at time zone 'America/Denver'); exception when others then v_ok := true; v_msg := sqlerrm; end;
  if not v_ok or v_msg not like '%already asked%' then raise exception 'FAIL: one reschedule request at a time (%)', v_msg; end if;
  v_ok := false; begin perform public.request_reschedule(v_r, (v_sat + time '11:00') at time zone 'America/Denver', (v_sat + time '12:00') at time zone 'America/Denver'); exception when others then v_ok := true; v_msg := sqlerrm; end;
  if not v_ok or v_msg not like '%confirmed lesson%' then raise exception 'FAIL: only confirmed lessons reschedule (%)', v_msg; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_o, 'role', 'authenticated')::text, true);
  v_ok := false; begin perform public.request_reschedule(v_b, (v_sat + time '11:00') at time zone 'America/Denver', (v_sat + time '12:00') at time zone 'America/Denver'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: cannot reschedule someone else''s lesson'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  perform public.cancel_my_booking(v_b);
  reset role;
  -- Pending requests are only resolved by the admin, even if the lesson is canceled.
  if (select status from public.bookings where id = v_r) <> 'PENDING' then raise exception 'FAIL: canceling the lesson leaves its reschedule request for the admin'; end if;
  if (select s.status from public.session_slots s join public.bookings b on b.session_slot_id = s.id where b.id = v_r) <> 'OPEN' then raise exception 'FAIL: the pending request keeps its time'; end if;
  if (select timezone from public.profiles where id = v_s) <> 'Europe/Lisbon' then raise exception 'FAIL: set_my_timezone'; end if;
end $$;

-- Admin alerts: new sign-ups and new subscribers
do $$
declare
  v_s uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_ok boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (v_s, 'db-test-alert-student@example.com', '{"full_name":"Alert Student"}', 'authenticated', 'authenticated'),
    (v_a, 'db-test-alert-admin@example.com', '{"full_name":"Alert Admin"}', 'authenticated', 'authenticated');
  update public.profiles set role = 'admin' where id = v_a;

  if not exists (select 1 from public.admin_alerts where user_id = v_s and kind = 'signup'
                 and name = 'Alert Student' and email = 'db-test-alert-student@example.com') then
    raise exception 'FAIL: a new account makes a sign-up alert';
  end if;

  insert into public.billing (user_id, stripe_customer_id, status) values (v_s, 'cus_db_test_alert', 'incomplete');
  update public.billing set status = 'active' where user_id = v_s;
  update public.billing set status = 'past_due' where user_id = v_s;
  update public.billing set status = 'active' where user_id = v_s;
  if (select count(*) from public.admin_alerts where user_id = v_s and kind = 'subscriber') <> 1 then
    raise exception 'FAIL: one subscriber alert when a subscription starts, none for a payment retry';
  end if;
  update public.billing set status = 'canceled' where user_id = v_s;
  update public.billing set status = 'active' where user_id = v_s;
  if (select count(*) from public.admin_alerts where user_id = v_s and kind = 'subscriber') <> 2 then
    raise exception 'FAIL: subscribing again after canceling makes a new alert';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.admin_alerts) then raise exception 'FAIL: students cannot read alerts'; end if;
  v_ok := false; begin perform public.save_push_subscription('https://push.example/x', 'k', 'a'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: students cannot sign up for alert pushes'; end if;
  v_ok := false; begin perform public.vapid_public_key(); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: only admins get the push key'; end if;
  v_ok := false; begin perform public.claim_alert_pushes('wrong'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: claiming pushes needs the job secret'; end if;
  v_ok := false; begin perform public.set_vapid_keys('wrong', 'p', 'q'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: saving push keys needs the job secret'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.admin_alerts where user_id = v_s) then raise exception 'FAIL: admins read alerts'; end if;
  update public.admin_alerts set read_at = now() where user_id = v_s;
  v_ok := false; begin update public.admin_alerts set kind = 'signup' where user_id = v_s; exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: admins can only mark alerts read'; end if;
  perform public.save_push_subscription('https://push.example/db-test', 'k', 'a');
  reset role;
  if (select count(*) from public.admin_alerts where user_id = v_s and read_at is null) <> 0 then raise exception 'FAIL: admins mark alerts read'; end if;
  if not exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/db-test' and user_id = v_a) then
    raise exception 'FAIL: admins save push devices';
  end if;

  delete from auth.users where id = v_s;
  if exists (select 1 from public.admin_alerts where user_id = v_s) then raise exception 'FAIL: deleting an account deletes its alerts'; end if;
end $$;

-- Class flags: only students with lesson access, one per class, emailed once
do $$
declare
  v_s uuid := gen_random_uuid();
  v_o uuid := gen_random_uuid();
  v_past uuid;
  v_old uuid;
  v_ok boolean;
  -- 3 AM Mountain, when no real class is booked.
  v_2days timestamptz := (date_trunc('day', now() at time zone 'America/Denver') - interval '2 days' + interval '3 hours') at time zone 'America/Denver';
  v_20days timestamptz := v_2days - interval '18 days';
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (v_s, 'db-test-flag-student@example.com', '{"full_name":"Flag Student"}', 'authenticated', 'authenticated'),
    (v_o, 'db-test-flag-other@example.com', '{"full_name":"Flag Other"}', 'authenticated', 'authenticated');
  update public.profiles set lesson_access = 'none' where id = v_s;
  update public.profiles set lesson_access = 'lifetime' where id = v_o;

  insert into public.session_slots (start_time, end_time, status)
  values (v_2days, v_2days + interval '1 hour', 'OPEN');
  insert into public.bookings (session_slot_id, student_id, status)
  values ((select id from public.session_slots where start_time = v_2days), v_s, 'CONFIRMED')
  returning id into v_past;
  insert into public.session_slots (start_time, end_time, status)
  values (v_20days, v_20days + interval '1 hour', 'OPEN');
  insert into public.bookings (session_slot_id, student_id, status)
  values ((select id from public.session_slots where start_time = v_20days), v_s, 'CONFIRMED')
  returning id into v_old;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  v_ok := false; begin perform public.flag_my_class(v_past, 'connection'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: students without lesson access cannot flag'; end if;
  v_ok := false; begin update public.bookings set flag_reason = 'other' where id = v_past; if not found then v_ok := true; end if; exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: students cannot set a flag directly'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_o, 'role', 'authenticated')::text, true);
  v_ok := false; begin perform public.flag_my_class(v_past, 'connection'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: students cannot flag someone else''s class'; end if;

  reset role;
  update public.profiles set lesson_access = 'subscriber' where id = v_s;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  v_ok := false; begin perform public.flag_my_class(v_past, 'bad'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: a flag needs one of the set reasons'; end if;
  v_ok := false; begin perform public.flag_my_class(v_old, 'other'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: a class over a week ago cannot be flagged'; end if;
  perform public.flag_my_class(v_past, 'connection');
  v_ok := false; begin perform public.flag_my_class(v_past, 'other'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: a class is flagged only once'; end if;
  reset role;

  if (select flag_reason from public.bookings where id = v_past) is distinct from 'connection' then
    raise exception 'FAIL: flagging saves the reason on the booking';
  end if;
  if (select count(*) from public.admin_alerts where user_id = v_s and kind = 'flag' and reason = 'connection'
      and class_start = v_2days and name = 'Flag Student') <> 1 then
    raise exception 'FAIL: flagging a class makes one admin alert';
  end if;

  insert into private.app_settings (key, value) values ('cron_secret', 'test-secret')
  on conflict (key) do update set value = excluded.value;
  set local role authenticated;
  v_ok := false; begin perform public.claim_flag_digest('wrong'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: the morning flag email needs the job secret'; end if;
  reset role;
  if not exists (select 1 from jsonb_array_elements(public.claim_flag_digest('test-secret')) f
                 where f ->> 'name' = 'Flag Student' and f ->> 'reason' = 'connection') then
    raise exception 'FAIL: the morning email gets the new flags';
  end if;
  if jsonb_array_length(public.claim_flag_digest('test-secret')) <> 0 then
    raise exception 'FAIL: a flag is emailed only once';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_o, 'role', 'authenticated')::text, true);
  v_ok := false; begin perform public.unflag_my_class(v_past); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FAIL: students cannot take back someone else''s flag'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  perform public.unflag_my_class(v_past);
  reset role;
  if (select flag_reason from public.bookings where id = v_past) is not null
     or exists (select 1 from public.admin_alerts where user_id = v_s and kind = 'flag') then
    raise exception 'FAIL: taking back a flag clears it and its alert';
  end if;
  set local role authenticated;
  perform public.flag_my_class(v_past, 'other');
  reset role;
  if (select flag_reason from public.bookings where id = v_past) is distinct from 'other' then
    raise exception 'FAIL: a class can be flagged again after taking the flag back';
  end if;
end $$;

-- A flag waits a minute before it's pushed
do $$
declare
  v_s uuid := gen_random_uuid();
  v_claimed text;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (v_s, 'db-test-wait@example.com', '{"full_name":"Wait Student"}', 'authenticated', 'authenticated');
  insert into private.app_settings (key, value) values ('cron_secret', 'test-secret')
  on conflict (key) do update set value = excluded.value;
  insert into public.admin_alerts (kind, user_id, name, reason) values ('flag', v_s, 'Fresh flag', 'other');
  insert into public.admin_alerts (kind, user_id, name, reason, created_at)
  values ('flag', v_s, 'Old flag', 'other', now() - interval '2 minutes');
  v_claimed := (public.claim_alert_pushes('test-secret') -> 'alerts')::text;
  if v_claimed like '%Fresh flag%' then raise exception 'FAIL: a flag waits a minute before it is pushed'; end if;
  if v_claimed not like '%Old flag%' then raise exception 'FAIL: a flag that waited a minute is pushed'; end if;
  if v_claimed not like '%db-test-wait@example.com%' then raise exception 'FAIL: sign-ups are still pushed at once'; end if;
end $$;

select 'ALL DATABASE TESTS PASSED' as result;

rollback;
