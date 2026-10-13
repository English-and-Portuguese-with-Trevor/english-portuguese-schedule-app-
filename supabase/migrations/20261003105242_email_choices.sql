-- Email choices (Trevor, 2026-10-03): each student picks how they hear about
-- new articles (email, in the app, or off; default in the app) and whether
-- the monthly summary is emailed (email or off; default email). Every site's
-- Settings > Preferences sets them with set_email_choices. Article emails go
-- out on Mondays, the day new articles are released, through
-- claim_article_emails (marks profiles.articles_emailed_on first, so once a
-- day; unclaim_article_emails hands a failed one back). The monthly summary
-- now skips students who turned it off and returns their site language, so
-- both student emails are written in it.

alter table public.profiles
  add column if not exists article_delivery text not null default 'app' check (article_delivery in ('email', 'app', 'off')),
  add column if not exists summary_delivery text not null default 'email' check (summary_delivery in ('email', 'off')),
  add column if not exists articles_emailed_on date;

create or replace function public.set_email_choices(p_articles text, p_summary text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_articles not in ('email', 'app', 'off') or p_summary not in ('email', 'off') then
    raise exception 'Unsupported email choice';
  end if;
  update public.profiles set article_delivery = p_articles, summary_delivery = p_summary where id = auth.uid();
end;
$$;
revoke execute on function public.set_email_choices(text, text) from public, anon;
grant execute on function public.set_email_choices(text, text) to authenticated;

create or replace function public.claim_article_emails(p_secret text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_people jsonb;
begin
  perform private.check_cron_secret(p_secret);
  with claimed as (
    update public.profiles p
    set articles_emailed_on = p_day
    where p.role <> 'admin'
      and p.email is not null
      and p.article_delivery = 'email'
      and (p.articles_emailed_on is null or p.articles_emailed_on < p_day)
    returning p.id, p.full_name, p.email, p.site_language, coalesce(p.learning_language, 'Portuguese') as learning
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into v_people from claimed;
  return v_people;
end;
$$;

create or replace function public.unclaim_article_emails(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.profiles set articles_emailed_on = null where id = any(p_ids);
end;
$$;

-- Like the other job functions: anyone may call, the secret guards them.
revoke execute on function public.claim_article_emails(text, date) from public;
revoke execute on function public.unclaim_article_emails(text, uuid[]) from public;
grant execute on function public.claim_article_emails(text, date) to anon, authenticated;
grant execute on function public.unclaim_article_emails(text, uuid[]) to anon, authenticated;

-- Same as 20261003081456_monthly_summary.sql, skipping students who turned
-- the summary off and returning their site language.
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
      and p.summary_delivery = 'email'
      and (p.summary_month is null or p.summary_month < v_month)
      and exists (select 1 from activity a where a.user_id = p.id and a.at >= v_from and a.at < v_to)
    returning p.id, p.full_name, p.email, p.timezone, p.site_language, coalesce(p.learning_language, 'Portuguese') as learning
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'full_name', c.full_name,
    'email', c.email,
    'timezone', c.timezone,
    'site_language', c.site_language,
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

