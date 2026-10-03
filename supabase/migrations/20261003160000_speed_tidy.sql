-- Speed tidy (Trevor ran this in the SQL editor, 2026-10-03): the game scores
-- policies (activities repo's 20261003053842_game_scores.sql) read auth.uid()
-- once per query instead of once per row, and the two new foreign keys get
-- their indexes.

alter policy game_scores_select_own_or_admin on public.game_scores
  using (user_id = (select auth.uid()) or private.is_admin());
alter policy game_scores_insert_own on public.game_scores
  with check (user_id = (select auth.uid()));
alter policy game_scores_update_own on public.game_scores
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists class_notes_updated_by_idx on public.class_notes (updated_by);
create index if not exists availability_blocks_created_by_idx on public.availability_blocks (created_by);
