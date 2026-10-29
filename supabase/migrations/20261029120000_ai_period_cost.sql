-- Sonnet until a threshold (Trevor, 2026-10-29): the route runs every feature
-- on Sonnet while this month's spend on every feature (the month from the
-- 27th, as month_cost) is under SONNET_UNTIL in src/lib/ai.ts, then on Haiku.
-- ai_limits gains period_cost for it; everything else is unchanged.
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
    'period_cost', coalesce((select sum(cost) from public.ai_turns, period where created_at >= period.start), 0),
    'day_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '24 hours'),
    'minute_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '1 minute'),
    'conversation_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation),
    'off_topic_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation and off_topic)
  );
$$;
