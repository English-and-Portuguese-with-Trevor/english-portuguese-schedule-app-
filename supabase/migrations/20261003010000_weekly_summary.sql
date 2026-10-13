-- Weekly summary email (Trevor, 2026-10-02): the daily job calls this on
-- Mondays and emails Trevor the last 7 days. Not applied yet: Trevor runs it
-- in the SQL editor, then the schedule app's waiting-on-sql-2 branch is
-- merged into main.
--
-- Guarded by the cron secret like admin_agenda; callable by anon because the
-- server's job client (createServerJobClient) uses the anon key. Admins'
-- own practice isn't counted. Names come back as full profiles so the app
-- makes the same "First L." short names as everywhere else.

create or replace function public.weekly_summary(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '7 days';
  v_result jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with students as (
    select id, created_at from public.profiles where role <> 'admin'
  ),
  -- Every moment a student did something, on any site.
  activity as (
    select user_id, finished_at as at from public.lesson_progress
    union all select user_id, updated_at from public.quiz_misses
    union all select user_id, finished_at from public.daily_results
    union all select user_id, finished_at from public.activity_results
    union all select user_id, created_at from public.study_events
    union all select user_id, updated_at from public.card_progress
    union all select student_id, created_at from public.bookings
    union all select student_id, cancelled_at from public.bookings where cancelled_at is not null
    union all
      select b.student_id, s.start_time
      from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.status = 'CONFIRMED' and s.start_time <= now()
  ),
  last_active as (
    select st.id, st.created_at, max(a.at) as at
    from students st left join activity a on a.user_id = st.id
    group by st.id, st.created_at
  )
  select jsonb_build_object(
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'created_at', p.created_at)), '[]'::jsonb)
      from public.profiles p
    ),
    'new_signups', (
      select coalesce(jsonb_agg(id order by created_at), '[]'::jsonb) from students where created_at >= v_since
    ),
    'new_subscribers', (
      select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb)
      from public.admin_alerts where kind = 'subscriber' and created_at >= v_since and user_id is not null
    ),
    'active_students', (
      select count(distinct a.user_id) from activity a join students st on st.id = a.user_id where a.at >= v_since
    ),
    'lessons_finished', (
      select count(*) from public.lesson_progress x join students st on st.id = x.user_id where x.finished_at >= v_since
    ),
    'puzzles_played', (
      select count(*) from public.daily_results x join students st on st.id = x.user_id where x.finished_at >= v_since
    ),
    'activities_finished', (
      select count(*) from public.activity_results x join students st on st.id = x.user_id where x.finished_at >= v_since
    ),
    'cards_studied', (
      select count(*) from public.study_events x join students st on st.id = x.user_id where x.created_at >= v_since
    ),
    'classes_held', (
      select count(*) from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.status = 'CONFIRMED' and s.start_time >= v_since and s.start_time <= now()
    ),
    'classes_canceled', (
      select count(*) from public.bookings b where b.status = 'CANCELLED' and b.cancelled_at >= v_since
    ),
    'late_cancellations', (
      select count(*) from public.bookings b where b.status = 'CANCELLED' and b.late_cancellation and b.cancelled_at >= v_since
    ),
    'upcoming', (
      select coalesce(jsonb_agg(jsonb_build_object('start', s.start_time, 'student_id', b.student_id, 'language', b.lesson_language) order by s.start_time), '[]'::jsonb)
      from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.status = 'CONFIRMED' and s.start_time > now() and s.start_time < now() + interval '7 days'
    ),
    -- Accounts at least 14 days old with nothing done in the last 14 days
    -- (last_active null: never did anything), longest quiet first.
    'inactive', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'last_active', at) order by at nulls first, created_at), '[]'::jsonb)
      from last_active
      where created_at < now() - interval '14 days' and (at is null or at < now() - interval '14 days')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.weekly_summary(text) from public;
grant execute on function public.weekly_summary(text) to anon, authenticated;
