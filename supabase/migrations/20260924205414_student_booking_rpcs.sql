-- Students no longer write bookings/session_slots directly: the old
-- policies let a student insert a CONFIRMED/override booking or update
-- their own booking to CONFIRMED. All student writes go through the
-- validated SECURITY DEFINER functions below; direct writes are admin-only.
drop policy if exists "bookings_insert_own_or_admin" on public.bookings;
drop policy if exists "bookings_update_own_or_admin" on public.bookings;

create policy "bookings_admin_insert" on public.bookings
  for insert with check (public.is_admin());
create policy "bookings_admin_update" on public.bookings
  for update using (public.is_admin()) with check (public.is_admin());

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

  insert into public.session_slots (start_time, end_time, type, max_capacity, status)
  values (p_start, p_end, 'INDIVIDUAL', 1, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings (session_slot_id, student_id, status, is_admin_override)
  values (v_slot_id, v_uid, 'PENDING', false)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

create or replace function public.request_class_booking(p_slot_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slot public.session_slots;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_slot from public.session_slots where id = p_slot_id;
  if v_slot.id is null or v_slot.type <> 'RECURRING_CLASS' or v_slot.status <> 'OPEN' then
    raise exception 'That class is no longer available.';
  end if;

  if v_slot.start_time < now() + interval '72 hours' then
    raise exception 'Classes must be requested at least 72 hours in advance.';
  end if;

  insert into public.bookings (session_slot_id, student_id, status, is_admin_override)
  values (p_slot_id, v_uid, 'PENDING', false)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

create or replace function public.cancel_my_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings
  set status = 'CANCELLED', cancelled_at = now()
  where id = p_booking_id
    and student_id = auth.uid()
    and status <> 'CANCELLED';

  if not found then
    raise exception 'Booking not found.';
  end if;
end;
$$;

revoke execute on function public.request_individual_booking(timestamptz, timestamptz) from public, anon;
revoke execute on function public.request_class_booking(uuid) from public, anon;
revoke execute on function public.cancel_my_booking(uuid) from public, anon;
grant execute on function public.request_individual_booking(timestamptz, timestamptz) to authenticated;
grant execute on function public.request_class_booking(uuid) to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;

-- A cancelled 1:1 booking must free its time: the overlap exclusion
-- constraint covers every OPEN individual slot, so a slot left OPEN with no
-- active booking would block that time forever.
create or replace function public.release_cancelled_individual_slot()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'CANCELLED' and old.status <> 'CANCELLED' then
    update public.session_slots s
    set status = 'CANCELLED'
    where s.id = new.session_slot_id
      and s.type = 'INDIVIDUAL'
      and not exists (
        select 1 from public.bookings b
        where b.session_slot_id = s.id and b.status <> 'CANCELLED'
      );
  end if;
  return new;
end;
$$;

revoke execute on function public.release_cancelled_individual_slot() from public, anon, authenticated;

drop trigger if exists trg_release_cancelled_individual_slot on public.bookings;
create trigger trg_release_cancelled_individual_slot
  after update of status on public.bookings
  for each row execute function public.release_cancelled_individual_slot();

-- Free any individual slots already orphaned by earlier cancellations.
update public.session_slots s
set status = 'CANCELLED'
where s.type = 'INDIVIDUAL'
  and s.status = 'OPEN'
  and not exists (
    select 1 from public.bookings b
    where b.session_slot_id = s.id and b.status <> 'CANCELLED'
  );
