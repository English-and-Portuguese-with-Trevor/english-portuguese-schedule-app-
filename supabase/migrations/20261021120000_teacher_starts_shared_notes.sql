-- Trevor starts notes for a student (Trevor, 2026-10-21: "I need to see our
-- shared notes: the ones they share, or the ones I create for them"). An
-- admin may add a note in a student's notebook only as a shared one (never
-- private), a topic or a sub-note of a note that student already shares. It
-- belongs to the student like the rest: they read, change, delete or make it
-- private as with any note of theirs. Trevor still deletes nothing.
create policy "Admins add shared notes for a student" on public.student_notes
  for insert to authenticated with check (
    private.is_admin()
    and not private
    and user_id <> (select auth.uid())
    and (parent_id is null or exists (select 1 from public.student_notes n where n.id = parent_id and n.user_id = student_notes.user_id and not n.private))
  );
