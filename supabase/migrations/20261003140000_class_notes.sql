-- Class notes (Trevor, 2026-10-03): after a class Trevor writes a few notes
-- (what they covered, homework, new words) on the admin dashboard (landing
-- repo); the student reads them on their dashboard. One note per booking.
-- Nothing is emailed (see Email volume in CLAUDE.md).

create table if not exists public.class_notes (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  notes text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) default auth.uid()
);

alter table public.class_notes enable row level security;

drop policy if exists class_notes_admin on public.class_notes;
create policy class_notes_admin on public.class_notes
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- A student reads the notes on their own classes.
drop policy if exists class_notes_own on public.class_notes;
create policy class_notes_own on public.class_notes
  for select to authenticated using (
    exists (
      select 1 from public.bookings b
      where b.id = class_notes.booking_id and b.student_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.class_notes to authenticated;
