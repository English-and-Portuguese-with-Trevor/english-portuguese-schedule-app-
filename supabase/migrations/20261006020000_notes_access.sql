-- My notes for testers and future students too (Trevor, 2026-10-06): besides
-- private students (a class package) and admins, an account with
-- profiles.notes_access can use My notes. Everyone in the database that day
-- was given it; new accounts start without it.
alter table public.profiles add column if not exists notes_access boolean not null default false;
update public.profiles set notes_access = true;

drop policy "Private students add their own notes" on public.student_notes;
create policy "Private students add their own notes" on public.student_notes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and (p.class_package is not null or p.role = 'admin' or p.notes_access)
    )
    and (parent_id is null or exists (select 1 from public.student_notes n where n.id = parent_id and n.user_id = (select auth.uid())))
  );
