-- There are no group classes: every session is a 1:1 with one student.
-- Drop the recurring-class tables, functions, and the capacity columns, and
-- replace the capacity trigger with a simple "one active booking per slot"
-- rule enforced by a unique index.

drop function if exists public.request_class_booking(uuid);

drop trigger if exists trg_check_slot_capacity on public.bookings;
drop function if exists public.check_slot_capacity();

create unique index bookings_one_active_per_slot
  on public.bookings (session_slot_id)
  where status <> 'CANCELLED';

-- The overlap guard's WHERE clause referenced `type`, so recreate it without.
alter table public.session_slots drop constraint session_slots_individual_no_overlap;
alter table public.session_slots drop constraint recurring_group_required;
alter table public.session_slots
  drop column recurring_group_id,
  drop column max_capacity,
  drop column type;
alter table public.session_slots
  add constraint session_slots_no_overlap
  exclude using gist (
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status = 'OPEN');

drop table public.recurring_groups;

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

  if p_start < now() + interval '72 hours' then
    raise exception 'Sessions must be requested at least 72 hours in advance.';
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
  values (v_slot_id, v_uid, 'PENDING', false)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- A cancelled booking frees its time: an OPEN slot with no active booking
-- would otherwise block that time forever via the overlap guard.
create or replace function public.release_cancelled_individual_slot()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'CANCELLED' and old.status <> 'CANCELLED' then
    update public.session_slots
    set status = 'CANCELLED'
    where id = new.session_slot_id;
  end if;
  return new;
end;
$$;
