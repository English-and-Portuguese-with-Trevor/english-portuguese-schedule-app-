-- Monthly student summary (Trevor, 2026-10-03): on the 1st of each month the
-- daily job emails every student who did anything last month (Denver
-- calendar month) what they did, in the language they're learning, and
-- their private classes. claim_monthly_summaries marks
-- profiles.summary_month first, so each month's email goes once; a failed
-- email is handed back with unclaim_monthly_summaries. Guarded by the cron
-- secret like the other job functions.

alter table public.profiles add column if not exists summary_month date;

create or replace function public.claim_monthly_summaries(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := (date_trunc('month', now() at time zone 'America/Denver') - interval '1 month')::date;
  v_from timestamptz := v_month::timestamp at time zone 'America/Denver';
  v_to timestamptz := (v_month + interval '1 month')::timestamp at time zone 'America/Denver';
  v_people jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with activity as (
    select user_id, finished_at as at from public.lesson_progress
    union all select user_id, updated_at from public.quiz_misses
    union all select user_id, finished_at from public.daily_results
    union all select user_id, finished_at from public.activity_results
    union all select user_id, created_at from public.study_events
    union all
      select b.student_id, s.start_time
      from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.status = 'CONFIRMED' and s.start_time <= now()
  ),
  claimed as (
    update public.profiles p
    set summary_month = v_month
    where p.role <> 'admin'
      and p.email is not null
      and (p.summary_month is null or p.summary_month < v_month)
      and exists (select 1 from activity a where a.user_id = p.id and a.at >= v_from and a.at < v_to)
    returning p.id, p.full_name, p.email, p.timezone, coalesce(p.learning_language, 'Portuguese') as learning
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'full_name', c.full_name,
    'email', c.email,
    'timezone', c.timezone,
    'learning', c.learning,
    'month', v_month,
    'classes_taken', (
      select count(*) from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.student_id = c.id and b.status = 'CONFIRMED' and s.start_time >= v_from and s.start_time < v_to and s.start_time <= now()
    ),
    'class_package', (select cp.class_package from private.class_progress(c.id) cp),
    'completed', (select cp.completed from private.class_progress(c.id) cp),
    'next_class', (
      select min(s.start_time) from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.student_id = c.id and b.status = 'CONFIRMED' and s.start_time > now()
    ),
    'lessons_done', (select coalesce(jsonb_agg(x.lesson_id), '[]'::jsonb) from public.lesson_progress x where x.user_id = c.id),
    'lessons_month', (
      select coalesce(jsonb_agg(x.lesson_id order by x.finished_at), '[]'::jsonb) from public.lesson_progress x
      where x.user_id = c.id and x.finished_at >= v_from and x.finished_at < v_to
    ),
    'puzzle_days', (
      select coalesce(jsonb_agg(distinct x.day), '[]'::jsonb) from public.daily_results x
      where x.user_id = c.id and x.track = case when c.learning = 'English' then 'en' else 'pt' end
        and x.day >= v_month and x.day < (v_month + interval '1 month')::date
    ),
    'activities_finished', (
      select count(*) from public.activity_results x
      where x.user_id = c.id and x.learning = c.learning and x.finished_at >= v_from and x.finished_at < v_to
    ),
    'cards_studied', (
      select count(*) from public.study_events x join public.decks d on d.id = x.deck_id
      where x.user_id = c.id and d.language = c.learning and x.created_at >= v_from and x.created_at < v_to
    )
  )), '[]'::jsonb)
  into v_people
  from claimed c;

  return v_people;
end;
$$;

create or replace function public.unclaim_monthly_summaries(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.profiles set summary_month = null where id = any(p_ids);
end;
$$;

-- Like the other job functions: anyone may call, the secret guards them.
revoke execute on function public.claim_monthly_summaries(text) from public;
revoke execute on function public.unclaim_monthly_summaries(text, uuid[]) from public;
grant execute on function public.claim_monthly_summaries(text) to anon, authenticated;
grant execute on function public.unclaim_monthly_summaries(text, uuid[]) to anon, authenticated;
