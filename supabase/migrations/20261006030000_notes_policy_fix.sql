-- Starting a note failed with "infinite recursion detected in policy for
-- relation student_notes": the insert and update rules looked the parent up
-- in student_notes itself. The parent check now goes through
-- private.owns_note (security definer, like private.has_lesson_access), which
-- reads the table without its policies.
create or replace function private.owns_note(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.student_notes n where n.id = p_id and n.user_id = auth.uid());
$$;
revoke execute on function private.owns_note(uuid) from public, anon;
grant execute on function private.owns_note(uuid) to authenticated;

drop policy "Private students add their own notes" on public.student_notes;
create policy "Private students add their own notes" on public.student_notes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and (p.class_package is not null or p.role = 'admin' or p.notes_access)
    )
    and (parent_id is null or private.owns_note(parent_id))
  );

drop policy "Students change their own notes" on public.student_notes;
create policy "Students change their own notes" on public.student_notes
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (parent_id is null or private.owns_note(parent_id))
  );
