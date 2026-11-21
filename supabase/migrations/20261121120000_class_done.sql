-- Class done (Trevor, 2026-11-21): a class counts toward the package once
-- Trevor says it was taught, not just because its time has passed. Classes
-- that didn't happen were left CONFIRMED and kept counting, so the package
-- counts drifted from the Planilha. Making the WhatsApp update is the moment
-- he knows a class was done, so the update's "Class done" button (the admin
-- dashboard's student hub and the home page's Viewing menu, landing repo;
-- the lessons site's Notes panel) marks it here with mark_class_done.
--
-- Completed classes = classes marked done + late cancellations +
-- profiles.earlier_classes (private.class_progress, behind
-- my_class_progress, admin_class_progress and the class emails).

alter table public.bookings add column if not exists completed_at timestamptz;
comment on column public.bookings.completed_at is
  'When Trevor marked the class taught (mark_class_done); only marked CONFIRMED classes count toward the package.';

-- Every class that has already ended keeps counting, so no count changes the
-- day this runs. Fix a class that didn't happen with mark_class_done(id, false).
update public.bookings b
set completed_at = s.end_time
from public.session_slots s
where s.id = b.session_slot_id
  and b.status = 'CONFIRMED'
  and s.end_time < now()
  and b.completed_at is null;

create or replace function private.class_progress(p_user uuid)
returns table (user_id uuid, class_package smallint, completed integer, needed integer, eligible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select
      p.id,
      p.class_package,
      p.lesson_access,
      p.earlier_classes + (
        select count(*)::integer
        from public.bookings b
        where b.student_id = p.id
          and ((b.status = 'CONFIRMED' and b.completed_at is not null) or b.late_cancellation)
      ) as completed
    from public.profiles p
    where p_user is null or p.id = p_user
  )
  select
    c.id,
    c.class_package,
    c.completed,
    (c.class_package * 3)::integer,
    c.class_package is not null and c.lesson_access <> 'lifetime' and c.completed >= c.class_package * 3
  from counted c;
$$;
revoke all on function private.class_progress(uuid) from public, anon, authenticated;

-- Admins only: mark a confirmed class that has started as taught (p_done
-- true) or take the mark back (false). Returns when it was marked, or null.
create or replace function public.mark_class_done(p_booking uuid, p_done boolean default true)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.bookings b
  set completed_at = case when p_done then coalesce(b.completed_at, now()) end
  from public.session_slots s
  where b.id = p_booking
    and s.id = b.session_slot_id
    and b.status = 'CONFIRMED'
    and s.start_time <= now()
  returning b.completed_at into v_at;
  if not found then
    raise exception 'Only a confirmed class that has started can be marked done' using errcode = '22023';
  end if;
  return v_at;
end;
$$;
revoke all on function public.mark_class_done(uuid, boolean) from public, anon;
grant execute on function public.mark_class_done(uuid, boolean) to authenticated;
