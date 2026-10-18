-- The Anthropic Console's spend limit resets on the 27th (Trevor, 2026-10-18),
-- so the app's month runs from the 27th too: otherwise a Console period could
-- hold the end of one app-month and most of the next and trip the $50 wall
-- before the $45 cap. The pool is counted since the start, unchanged.
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
      and feature not in ('writing', 'story', 'madlibs', 'why', 'classnote')), 0),
    'pool_cost', coalesce((select sum(cost) from public.ai_turns where feature in ('writing', 'story', 'madlibs', 'why', 'classnote')), 0),
    'day_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '24 hours'),
    'minute_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '1 minute'),
    'conversation_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation),
    'off_topic_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation and off_topic)
  );
$$;
