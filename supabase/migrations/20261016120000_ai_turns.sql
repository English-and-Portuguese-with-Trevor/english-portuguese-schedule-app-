-- AI conversation partner (Trevor, 2026-10-16): logged-in students talk to
-- Claude (Haiku) through this app's /api/ai. Every turn is a row here, the
-- ledger that enforces the monthly wall ($45 in the app, under the $50 spend
-- limit on the Anthropic Console workspace) and the log Trevor reads on the
-- admin dashboard's AI tab. Only the server (service role) writes; admins
-- read. Students never touch the table or the settings.

create table if not exists public.ai_turns (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('partner', 'helper')),
  conversation_id uuid not null,
  scene text,
  student text not null,
  reply text not null,
  -- The model declined something that wasn't language practice (three in a conversation end it).
  off_topic boolean not null default false,
  model text not null,
  input_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- US dollars.
  cost numeric(10, 6) not null default 0,
  stop_reason text,
  created_at timestamptz not null default now()
);
create index if not exists ai_turns_user_created on public.ai_turns (user_id, created_at desc);
create index if not exists ai_turns_conversation on public.ai_turns (conversation_id, created_at);
create index if not exists ai_turns_created on public.ai_turns (created_at desc);

alter table public.ai_turns enable row level security;
revoke all on public.ai_turns from public, anon, authenticated;
grant select on public.ai_turns to authenticated;
grant all on public.ai_turns to service_role;
drop policy if exists ai_turns_admin_select on public.ai_turns;
create policy ai_turns_admin_select on public.ai_turns
  for select to authenticated using (private.is_admin());

-- One row: the kill switch and the caps Trevor tunes on the AI tab. The cap
-- can never be set above $50 (the Console workspace's limit).
create table if not exists public.ai_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  monthly_cap numeric(8, 2) not null default 45 check (monthly_cap between 0 and 50),
  daily_turns integer not null default 30 check (daily_turns between 0 and 500),
  updated_at timestamptz not null default now()
);
insert into public.ai_settings (id) values (true) on conflict do nothing;

alter table public.ai_settings enable row level security;
revoke all on public.ai_settings from public, anon, authenticated;
grant select, update (enabled, monthly_cap, daily_turns, updated_at) on public.ai_settings to authenticated;
grant all on public.ai_settings to service_role;
drop policy if exists ai_settings_admin_select on public.ai_settings;
create policy ai_settings_admin_select on public.ai_settings
  for select to authenticated using (private.is_admin());
drop policy if exists ai_settings_admin_update on public.ai_settings;
create policy ai_settings_admin_update on public.ai_settings
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- A student Trevor blocks from the AI features (admin dashboard, Student page).
alter table public.profiles add column if not exists ai_blocked boolean not null default false;

-- What the route checks before every call: this month's spend across every
-- student, the student's turns in the last 24 hours and the last minute, and
-- the conversation's turns and off-topic turns. Server only.
create or replace function public.ai_limits(p_user uuid, p_conversation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'month_cost', coalesce((select sum(cost) from public.ai_turns where created_at >= date_trunc('month', now())), 0),
    'day_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '24 hours'),
    'minute_turns', (select count(*) from public.ai_turns where user_id = p_user and created_at > now() - interval '1 minute'),
    'conversation_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation),
    'off_topic_turns', (select count(*) from public.ai_turns where user_id = p_user and conversation_id = p_conversation and off_topic)
  );
$$;

revoke execute on function public.ai_limits(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ai_limits(uuid, uuid) to service_role;
