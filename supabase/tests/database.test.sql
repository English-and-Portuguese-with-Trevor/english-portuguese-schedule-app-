-- Database security and booking-rule tests.
--
-- These check the rules that actually protect the data: row-level security,
-- the booking functions (request_individual_booking, request_class_booking,
-- cancel_my_booking), and the overlap/capacity constraints. The app's own
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
  v_group   uuid;
  v_class   uuid;
  v_near_class uuid;
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

  -- The first Saturday at least 5 days out, so it's past the 72-hour cutoff.
  v_sat := (now() at time zone 'America/Denver')::date + 5;
  v_sat := v_sat + ((6 - extract(dow from v_sat)::int + 7) % 7);
  v_10   := (v_sat + time '10:00') at time zone 'America/Denver';
  v_1015 := (v_sat + time '10:15') at time zone 'America/Denver';
  v_11   := (v_sat + time '11:00') at time zone 'America/Denver';
  v_1105 := (v_sat + time '11:05') at time zone 'America/Denver';
  v_1115 := (v_sat + time '11:15') at time zone 'America/Denver';
  v_12   := (v_sat + time '12:00') at time zone 'America/Denver';
  v_1215 := (v_sat + time '12:15') at time zone 'America/Denver';

  insert into public.recurring_groups (title, day_of_week, start_time, duration_minutes, starts_on, ends_on, max_capacity, created_by)
  values ('DB test class', 6, '14:00', 60, v_sat, v_sat, 1, v_admin)
  returning id into v_group;
  insert into public.session_slots (start_time, end_time, type, max_capacity, recurring_group_id, status)
  values ((v_sat + time '14:00') at time zone 'America/Denver', (v_sat + time '15:00') at time zone 'America/Denver',
          'RECURRING_CLASS', 1, v_group, 'OPEN')
  returning id into v_class;
  insert into public.session_slots (start_time, end_time, type, max_capacity, recurring_group_id, status)
  values (now() + interval '1 day', now() + interval '1 day 1 hour', 'RECURRING_CLASS', 5, v_group, 'OPEN')
  returning id into v_near_class;

  ---------------------------------------------------------------------------
  -- As a student
  ---------------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- Booking a valid slot creates a pending, non-override request.
  v_booking := public.request_individual_booking(v_10, v_11);
  select status || '/' || is_admin_override::text || '/' || (student_id = v_student)::text
    into v_text from public.bookings where id = v_booking;
  if v_text is distinct from 'PENDING/false/true' then
    raise exception 'FAIL: a student request is PENDING, not an override, and theirs (got %)', v_text;
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

  -- Back-to-back with an existing session is fine.
  perform public.request_individual_booking(v_11, v_12);

  -- A session that would run past the window's end is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(v_1115, v_1215);
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%no longer available%' then
    raise exception 'FAIL: a session running past the window end is refused (%)', v_msg;
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

  -- Anything inside 72 hours is refused.
  v_failed := false;
  begin
    perform public.request_individual_booking(now() + interval '1 day', now() + interval '1 day 1 hour');
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%72 hours%' then
    raise exception 'FAIL: requests inside 72 hours are refused (%)', v_msg;
  end if;

  -- Students cannot write slots, bookings, or availability directly.
  v_failed := false;
  begin
    insert into public.session_slots (start_time, end_time, type, max_capacity, status)
    values (v_10 + interval '7 days', v_11 + interval '7 days', 'INDIVIDUAL', 1, 'OPEN');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: students cannot insert session slots directly'; end if;

  v_failed := false;
  begin
    insert into public.bookings (session_slot_id, student_id, status, is_admin_override)
    values (v_class, v_student, 'CONFIRMED', true);
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

  -- Students cannot confirm their own request.
  update public.bookings set status = 'CONFIRMED' where id = v_booking;
  if (select status from public.bookings where id = v_booking) <> 'PENDING' then
    raise exception 'FAIL: students cannot confirm their own booking';
  end if;

  -- Students cannot promote themselves to admin.
  update public.profiles set role = 'admin' where id = v_student;
  if (select role from public.profiles where id = v_student) <> 'student' then
    raise exception 'FAIL: students cannot make themselves admin';
  end if;

  -- Class requests respect the 72-hour cutoff.
  v_failed := false;
  begin
    perform public.request_class_booking(v_near_class);
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%72 hours%' then
    raise exception 'FAIL: class requests inside 72 hours are refused (%)', v_msg;
  end if;

  -- Joining a class with room works.
  perform public.request_class_booking(v_class);

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

  -- A full class (capacity 1, already joined) refuses another student.
  v_failed := false;
  begin
    perform public.request_class_booking(v_class);
  exception when others then v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed or v_msg not like '%capacity%' then
    raise exception 'FAIL: a full class refuses more students (%)', v_msg;
  end if;

  ---------------------------------------------------------------------------
  -- Back as the first student: cancelling frees the time
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.cancel_my_booking(v_booking);

  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  perform public.request_individual_booking(v_10, v_11);

  ---------------------------------------------------------------------------
  -- As an admin
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select id into v_booking from public.bookings
  where student_id = v_other and status = 'PENDING' and session_slot_id in (select id from public.session_slots where type = 'INDIVIDUAL')
  limit 1;
  update public.bookings set status = 'CONFIRMED' where id = v_booking;
  if (select status from public.bookings where id = v_booking) <> 'CONFIRMED' then
    raise exception 'FAIL: admins can confirm a booking';
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
