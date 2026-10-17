-- My mistakes on the notebook site (Trevor, 2026-10-17): the activity
-- questions a student missed (activity_results.missed holds only each
-- question's id and the answer given), with the question's text and right
-- answer from activity_content, which students without lesson access can't
-- read; this hands them only the questions they already saw and missed.
-- One row per question across every run: how many times, the latest answer
-- given, the last time. The student reads their own; admins any student's.
-- The text fields mirror exerciseText / exerciseAnswer in the landing repo's
-- src/admin/stats.js.
create or replace function public.my_activity_misses(p_student uuid default null)
returns table (
  topic_id text,
  activity_id text,
  exercise_id text,
  learning text,
  question text,
  answer text,
  given text,
  times integer,
  last_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  with student as (
    select coalesce(p_student, auth.uid()) as id
  ),
  misses as (
    select r.topic_id, r.activity_id, r.learning, m->>'id' as exercise_id, m->>'answer' as given, r.finished_at
    from public.activity_results r, jsonb_array_elements(r.missed) m, student s
    where r.user_id = s.id
      and (s.id = auth.uid() or private.is_admin())
      and jsonb_typeof(r.missed) = 'array'
  ),
  grouped as (
    select topic_id, activity_id, learning, exercise_id,
      (array_agg(given order by finished_at desc))[1] as given,
      count(*)::int as times,
      max(finished_at) as last_at
    from misses
    group by topic_id, activity_id, learning, exercise_id
  ),
  exercises as (
    select e->>'id' as id, e
    from public.activity_content c, jsonb_array_elements(c.exercises) e
    where jsonb_typeof(c.exercises) = 'array'
  )
  select g.topic_id, g.activity_id, g.exercise_id, g.learning,
    coalesce(x.e->>'prompt', x.e->>'target', x.e->>'text', g.exercise_id) as question,
    coalesce(
      x.e->'accept'->>0,
      x.e->>'target',
      x.e->>'answer',
      x.e->>'sample',
      case when jsonb_typeof(x.e->'blanks') = 'array'
        then (select string_agg(b->>0, ' / ') from jsonb_array_elements(x.e->'blanks') b) end,
      case when jsonb_typeof(x.e->'items') = 'array'
        then (select string_agg((i->>'group') || ' ' || (i->>'word'), ', ') from jsonb_array_elements(x.e->'items') i) end,
      ''
    ) as answer,
    g.given, g.times, g.last_at
  from grouped g
  left join exercises x on x.id = g.exercise_id
  order by g.last_at desc;
$$;

revoke all on function public.my_activity_misses(uuid) from public;
grant execute on function public.my_activity_misses(uuid) to authenticated;
