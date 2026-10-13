-- Late cancellations still count as a class, so they count toward the three class sets.
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
