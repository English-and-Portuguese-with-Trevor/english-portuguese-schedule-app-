-- A student's profile time zone follows the browser they book from
-- (Trevor, 2026-10-08: Rafaela, in Brazil, booked from São Paulo but her
-- profile still had the Los Angeles default). The booking emails already use
-- the booking's time zone; the weekly class update, the monthly summary and
-- the daily practice reminder read profiles.timezone. Bookings Trevor makes
-- (is_admin_override) carry his browser's zone, so they never change it.
-- Unknown zones are Denver.

create or replace function private.profile_timezone_from_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_admin_override
     and exists (select 1 from pg_catalog.pg_timezone_names where name = new.student_timezone) then
    update public.profiles
    set timezone = new.student_timezone
    where id = new.student_id and role <> 'admin' and timezone is distinct from new.student_timezone;
  end if;
  return new;
exception when others then
  raise warning 'profile_timezone_from_booking: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function private.profile_timezone_from_booking() from public, anon, authenticated;

drop trigger if exists bookings_profile_timezone on public.bookings;
create trigger bookings_profile_timezone
  after insert on public.bookings
  for each row execute function private.profile_timezone_from_booking();

-- Until someone books, assume Denver (Trevor's zone), not Los Angeles: new
-- accounts start there, and the old default moves there unless a booking
-- says Los Angeles.
alter table public.profiles alter column timezone set default 'America/Denver';
update public.profiles p
set timezone = 'America/Denver'
where p.timezone = 'America/Los_Angeles'
  and not exists (select 1 from public.bookings b where b.student_id = p.id and b.student_timezone = 'America/Los_Angeles');

-- The accounts that already booked from another zone: their latest own booking's.
update public.profiles p
set timezone = latest.student_timezone
from (
  select distinct on (b.student_id) b.student_id, b.student_timezone
  from public.bookings b
  where not b.is_admin_override
    and b.student_timezone in (select name from pg_catalog.pg_timezone_names)
  order by b.student_id, b.created_at desc
) latest
where p.id = latest.student_id and p.role <> 'admin' and p.timezone is distinct from latest.student_timezone;
