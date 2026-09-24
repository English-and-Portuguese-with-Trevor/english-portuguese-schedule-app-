-- Students can now request any future time. Sessions at least 72 hours away
-- are confirmed right away; sooner ones stay PENDING until an admin approves.
create or replace function public.request_individual_booking(p_start timestamptz, p_end timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slot_id uuid;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

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

  insert into public.session_slots (start_time, end_time, status)
  values (p_start, p_end, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings (session_slot_id, student_id, status, is_admin_override)
  values (
    v_slot_id,
    v_uid,
    case when p_start >= now() + interval '72 hours' then 'CONFIRMED' else 'PENDING' end,
    false
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;
