-- The tools pool (Trevor, 2026-10-18): the writing coach, the story builder,
-- the mad libs check, "Why was this wrong?" and the class-note tidy-up are
-- paid from ai_settings.tools_cap ($30 of the bonus API credits, counted
-- since the start, not monthly; the database refuses more than 100), apart
-- from the partner's monthly cap. Keep the feature list in step with
-- POOL_FEATURES in src/lib/ai.ts.
alter table public.ai_turns drop constraint if exists ai_turns_feature_check;
alter table public.ai_turns add constraint ai_turns_feature_check
  check (feature in ('partner', 'helper', 'questions', 'vocab', 'writing', 'story', 'madlibs', 'why', 'classnote'));
-- "Why was this wrong?" looks an earlier explanation up by feature, lesson and message.
create index if not exists ai_turns_feature_scene on public.ai_turns (feature, scene);

alter table public.ai_settings add column if not exists tools_cap numeric(8, 2) not null default 30 check (tools_cap between 0 and 100);
grant update (tools_cap) on public.ai_settings to authenticated;

create or replace function public.ai_limits(p_user uuid, p_conversation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'month_cost', coalesce((select sum(cost) from public.ai_turns where created_at >= date_trunc('month', now())
      and feature not in ('writing', 'story', 'madlibs', 'why', 'classnote')), 0),
    'pool_cost', coalesce((select sum(cost) from public.ai_turns where feature in ('writing', 'story', 'madlibs', 'why', 'classnote')), 0),
    'day_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '24 hours'),
    'minute_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '1 minute'),
    'conversation_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation),
    'off_topic_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation and off_topic)
  );
$$;

-- The pool's spend so far, for the admin dashboard's AI tab (the rows are
-- admin-readable, so anyone else gets 0).
create or replace function public.ai_pool_cost()
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost), 0) from public.ai_turns where feature in ('writing', 'story', 'madlibs', 'why', 'classnote');
$$;
grant execute on function public.ai_pool_cost() to authenticated;
