-- Days off (Trevor, 2026-10-02): dates (or a range) when no class can be
-- booked, on top of the weekly availability_rules. Dates are calendar dates in
-- each rule's time zone (Denver). Trevor ran this in the SQL editor.

create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

alter table public.availability_blocks enable row level security;

-- Students' booking board needs the dates (there's nothing else in the row).
drop policy if exists availability_blocks_select on public.availability_blocks;
create policy availability_blocks_select on public.availability_blocks
  for select to authenticated using (true);

drop policy if exists availability_blocks_admin on public.availability_blocks;
create policy availability_blocks_admin on public.availability_blocks
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

grant select, insert, update, delete on public.availability_blocks to authenticated;

-- Same as 20261001150000_short_classes_for_new_students.sql, refusing a time
-- on a day off.
create or replace function private.assert_lesson_time(p_start timestamptz, p_end timestamptz, p_student uuid)
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
revoke execute on function private.assert_lesson_time(timestamptz, timestamptz, uuid) from public, anon, authenticated;
