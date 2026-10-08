-- My notes shared with Trevor (Trevor, 2026-10-08): a student's notes are
-- shared with Trevor (admins), who reads and edits them live from the
-- notebook site, unless the student marks a note Private: then only the
-- student sees it, Trevor included. Notes written before today were promised
-- to be private, so they start Private; new notes start shared.
-- Both can type in a note at once, like a Google Doc: the text is a Yjs
-- document (its state saved in ydoc, base64, beside the plain body), kept in
-- step over the note's private Realtime channel `note:<id>`.
alter table public.student_notes add column if not exists private boolean not null default false;
alter table public.student_notes add column if not exists ydoc text check (char_length(ydoc) <= 2000000);
update public.student_notes set private = true;

-- Trevor reads and changes the notes that aren't private. He never adds or
-- deletes them, and never moves one or makes it private (the trigger below).
create policy "Admins read shared notes" on public.student_notes
  for select to authenticated using (not private and private.is_admin());
create policy "Admins change shared notes" on public.student_notes
  for update to authenticated using (not private and private.is_admin()) with check (not private and private.is_admin());

-- A note added or changed: its updated_at, and the student's year starts
-- again. Someone else (Trevor) changing it keeps its owner, place and
-- privacy as they were.
create or replace function private.student_note_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.user_id is distinct from auth.uid() then
    new.user_id := old.user_id;
    new.parent_id := old.parent_id;
    new.private := old.private;
  end if;
  new.updated_at := now();
  update public.profiles set notes_active_at = now(), notes_warned_at = null where id = new.user_id;
  return new;
end;
$$;

-- A note's live channel: only those who can read the note (row-level
-- security on student_notes: the student, and Trevor while it isn't private)
-- may listen or send on it.
create policy "Note readers use its live channel" on realtime.messages
  for select to authenticated using (
    realtime.messages.extension = 'broadcast'
    and exists (select 1 from public.student_notes n where 'note:' || n.id::text = (select realtime.topic()))
  );
create policy "Note readers send on its live channel" on realtime.messages
  for insert to authenticated with check (
    realtime.messages.extension = 'broadcast'
    and exists (select 1 from public.student_notes n where 'note:' || n.id::text = (select realtime.topic()))
  );

-- Live: changes reach the other person's open notebook (row-level security
-- still decides who gets each change).
alter publication supabase_realtime add table public.student_notes;
