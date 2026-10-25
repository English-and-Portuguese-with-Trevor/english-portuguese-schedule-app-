-- Homework (Trevor, 2026-10-25): the student hub on the admin dashboard
-- (landing repo, /admin/#/hub/<id>) gives a private student up to 10 things
-- to do between classes, written by Trevor or drawn up by the AI from his
-- class notes. One row per item. Admins do everything; the student reads
-- their own and ticks an item done (mark_homework). The student reads the
-- list on this app's dashboard under "Homework from Trevor". Nothing is
-- emailed or pushed (see Email volume in CLAUDE.md).

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The class it came out of, when it did.
  booking_id uuid references public.bookings (id) on delete set null,
  text text not null check (length(text) between 1 and 500),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index if not exists homework_user_created on public.homework (user_id, created_at desc);

alter table public.homework enable row level security;
revoke all on public.homework from public, anon, authenticated;
grant select, insert, update, delete on public.homework to authenticated;

drop policy if exists homework_admin on public.homework;
create policy homework_admin on public.homework
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists homework_own_select on public.homework;
create policy homework_own_select on public.homework
  for select to authenticated using (user_id = (select auth.uid()));

-- The student ticks an item done (or un-ticks it); nothing else is theirs to change.
create or replace function public.mark_homework(p_id uuid, p_done boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.homework
  set done_at = case when p_done then coalesce(done_at, now()) end
  where id = p_id and user_id = (select auth.uid());
$$;
revoke execute on function public.mark_homework(uuid, boolean) from public, anon;
grant execute on function public.mark_homework(uuid, boolean) to authenticated;

-- Two more admin-only AI features on /api/ai, paid from the tools pool:
-- 'classplan' (the hub's Today's class: the note for the student and the
-- homework list from Trevor's shorthand) and 'homework' (homework prompts
-- from what the student is studying). Keep the lists in step with
-- POOL_FEATURES in src/lib/ai.ts.
alter table public.ai_turns drop constraint if exists ai_turns_feature_check;
alter table public.ai_turns add constraint ai_turns_feature_check
  check (feature in ('partner', 'helper', 'questions', 'vocab', 'writing', 'story', 'madlibs', 'why', 'classnote', 'classplan', 'homework'));

create or replace function public.ai_limits(p_user uuid, p_conversation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with period as (
    select case when extract(day from now() at time zone 'UTC') >= 27
      then date_trunc('month', now() at time zone 'UTC') + interval '26 days'
      else date_trunc('month', now() at time zone 'UTC') - interval '1 month' + interval '26 days'
    end at time zone 'UTC' as start
  )
  select jsonb_build_object(
    'month_cost', coalesce((select sum(cost) from public.ai_turns, period where created_at >= period.start
      and feature not in ('writing', 'story', 'madlibs', 'why', 'classnote', 'classplan', 'homework')), 0),
    'pool_cost', coalesce((select sum(cost) from public.ai_turns where feature in ('writing', 'story', 'madlibs', 'why', 'classnote', 'classplan', 'homework')), 0),
    'day_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '24 hours'),
    'minute_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '1 minute'),
    'conversation_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation),
    'off_topic_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation and off_topic)
  );
$$;

create or replace function public.ai_pool_cost()
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost), 0) from public.ai_turns where feature in ('writing', 'story', 'madlibs', 'why', 'classnote', 'classplan', 'homework');
$$;
