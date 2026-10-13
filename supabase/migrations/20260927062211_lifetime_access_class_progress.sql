-- Lifetime lesson access and class-set progress.
--
-- 'lifetime' is only ever set by Trevor (an admin) by hand. The app flags
-- students who qualify: three full class sets, i.e. 12 completed classes on
-- the 4-class package or 24 on the 8-class package. Completed classes are
-- confirmed bookings whose time has passed and late cancellations (which
-- still count as a class), plus classes Trevor records as taken before the
-- schedule app existed (earlier_classes).
alter table public.profiles drop constraint profiles_lesson_access_check;
alter table public.profiles
  add constraint profiles_lesson_access_check
  check (lesson_access in ('none', 'granted', 'subscriber', 'lifetime'));

alter table public.profiles
  add column class_package smallint check (class_package in (4, 8)),
  add column earlier_classes integer not null default 0 check (earlier_classes between 0 and 1000);

-- Only admins can update profiles (profiles_update policy); these columns are
-- set from the Users page.
grant update (class_package, earlier_classes) on public.profiles to authenticated;

create or replace function private.has_lesson_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.lesson_access in ('granted', 'subscriber', 'lifetime') or p.role = 'admin')
  );
$$;

-- Three class sets qualify a student for lifetime access.
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
        join public.session_slots s on s.id = b.session_slot_id
        where b.student_id = p.id
          and ((b.status = 'CONFIRMED' and s.end_time < now()) or b.late_cancellation)
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

-- The signed-in student's own progress.
create or replace function public.my_class_progress()
returns table (user_id uuid, class_package smallint, completed integer, needed integer, eligible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.class_progress(auth.uid()) where auth.uid() is not null;
$$;

-- Everyone's progress, for the admin Users page.
create or replace function public.admin_class_progress()
returns table (user_id uuid, class_package smallint, completed integer, needed integer, eligible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.class_progress(null) where private.is_admin();
$$;

revoke all on function public.my_class_progress() from public, anon;
revoke all on function public.admin_class_progress() from public, anon;
grant execute on function public.my_class_progress() to authenticated;
grant execute on function public.admin_class_progress() to authenticated;
