-- The vocab translator (feature 'vocab', the lessons site's Notes panel) is
-- logged in ai_turns like the other AI features.
alter table public.ai_turns drop constraint if exists ai_turns_feature_check;
alter table public.ai_turns add constraint ai_turns_feature_check check (feature in ('partner', 'helper', 'questions', 'vocab'));
