-- My notes is for Trevor's private students only (Trevor, 2026-10-06): only
-- an account with a class package (or an admin) can start a note. Anyone can
-- still open, change and delete the notes they already have, so a student
-- whose package ends keeps them until the yearly cleanup
-- (20261005220000_student_notes.sql) warns them and deletes them.
drop policy "Students add their own notes" on public.student_notes;
create policy "Private students add their own notes" on public.student_notes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and (p.class_package is not null or p.role = 'admin')
    )
    and (parent_id is null or exists (select 1 from public.student_notes n where n.id = parent_id and n.user_id = (select auth.uid())))
  );
