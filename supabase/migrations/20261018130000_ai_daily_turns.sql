-- Students get 1,000 AI turns a day (Trevor, 2026-10-18, from what the first
-- days showed); the setting's ceiling goes from 500 to 2,000. The minute cap
-- (6) and the money caps still hold.
alter table public.ai_settings drop constraint if exists ai_settings_daily_turns_check;
alter table public.ai_settings add constraint ai_settings_daily_turns_check check (daily_turns between 0 and 2000);
update public.ai_settings set daily_turns = 1000, updated_at = now() where id;
