-- Security audit (2026-10-10): a logged-in account could write without limit
-- into the tracking tables (storage on the free plan, junk on the admin
-- dashboard). Size checks where a column had none, and per-account caps
-- where a function or trigger already stands in the way.

-- Pill events: at most 300 a day per account (a real day is a handful).
create or replace function public.log_pill_event(p_site text, p_action text, p_pill text, p_target text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.pill_events
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 300 then
    return;
  end if;
  insert into public.pill_events (user_id, site, action, pill, target)
  values (auth.uid(), p_site, p_action, p_pill, left(p_target, 200));
  delete from public.pill_events where created_at < now() - interval '180 days';
end;
$$;

-- Notes: at most 500 per student (the trigger already runs as definer, so it
-- can count past the row-level rules).
create or replace function private.student_note_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.student_notes where user_id = new.user_id) >= 500 then
    raise exception 'That''s the most notes an account can keep (500). Delete one to add another.';
  end if;
  if tg_op = 'UPDATE' and old.user_id is distinct from auth.uid() then
    new.user_id := old.user_id;
    new.parent_id := old.parent_id;
    new.private := old.private;
  end if;
  new.updated_at := now();
  update public.profiles set notes_active_at = now(), notes_warned_at = null where id = new.user_id;
  return new;
end;
$$;

-- Lesson misses: at most 5,000 rows per student in each table (the banks are
-- a few hundred items; the cap only stops a script).
create or replace function public.record_drill_miss(p_lesson text, p_prompt text, p_answer text, p_typed text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.drill_misses (user_id, lesson_id, prompt, answer, typed)
  select auth.uid(), p_lesson, left(p_prompt, 300), left(p_answer, 200), left(p_typed, 200)
  where (select count(*) from public.drill_misses where user_id = auth.uid()) < 5000
  on conflict (user_id, lesson_id, prompt) do update
    set misses = public.drill_misses.misses + 1,
        answer = excluded.answer,
        typed = excluded.typed,
        updated_at = now();
$$;

create or replace function public.record_quiz_miss(p_lesson text, p_question_no integer, p_question text, p_tries integer, p_picked text[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.quiz_misses (user_id, lesson_id, question_no, question, tries, picked)
  select auth.uid(), p_lesson, p_question_no, left(p_question, 500), least(p_tries, 20), p_picked[1:20]
  where (select count(*) from public.quiz_misses where user_id = auth.uid()) < 5000
  on conflict (user_id, lesson_id, question) do update
    set tries = greatest(public.quiz_misses.tries, excluded.tries),
        question_no = excluded.question_no,
        picked = coalesce(excluded.picked, public.quiz_misses.picked),
        updated_at = now();
$$;

-- The older four-argument record_quiz_miss is no longer called by the site.
drop function if exists public.record_quiz_miss(text, integer, text, integer);

-- Sizes the client used to be trusted with.
alter table public.activity_results
  add constraint activity_results_missed_size check (pg_column_size(missed) <= 16384);
alter table public.placement_results
  add constraint placement_results_sizes check (
    pg_column_size(missed) <= 16384 and pg_column_size(skills) <= 2048
    and char_length(coalesce(start_lesson, '')) <= 100
  );
alter table public.game_scores
  add constraint game_scores_best_range check (best >= 0 and best <= 1000000000);
