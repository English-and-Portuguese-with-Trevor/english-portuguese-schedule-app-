-- My mistakes on the notebook site (Trevor, 2026-10-17): a student's "Got it"
-- ticks on the knowledge checks and drill items they missed (quiz_misses,
-- drill_misses). One row per tick; `key` is "<quiz|drill>:<lesson id>:<question or prompt>"
-- (the notebook repo's src/lib/mistakes.js). The student ticks and unticks
-- their own; admins read them (the misses themselves are read by both already).
create table public.mistakes_done (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key text not null check (length(key) <= 600),
  done_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.mistakes_done enable row level security;

create policy "Students read their own ticks" on public.mistakes_done
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

create policy "Students tick their own mistakes" on public.mistakes_done
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Students untick their own mistakes" on public.mistakes_done
  for delete to authenticated
  using (user_id = (select auth.uid()));
