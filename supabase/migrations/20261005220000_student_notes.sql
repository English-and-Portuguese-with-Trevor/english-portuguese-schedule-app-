-- My notes (Trevor, 2026-10-05): every student's own notes, on the landing
-- site's /notes/ page. Each note can sit under another one (topics with
-- sub-notes, like Google Docs' tabs), and carries tags the student types.
-- Private: a student reads and writes only their own; nobody else, Trevor
-- included, reads them.
--
-- Kept for a year: notes nobody opened or changed for 11 months get a warning
-- email (claim_notes_warnings), and a year without use, at least 30 days
-- after that email, they're deleted (delete_stale_notes); both from the
-- schedule app's daily job. Opening /notes/ (touch_my_notes) or changing a
-- note starts the year again.

create table public.student_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  parent_id uuid references public.student_notes(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 100000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_notes_user_id_idx on public.student_notes (user_id);
create index student_notes_parent_id_idx on public.student_notes (parent_id);

alter table public.student_notes enable row level security;

create policy "Students read their own notes" on public.student_notes
  for select to authenticated using (user_id = (select auth.uid()));
-- A sub-note's parent must be one of the student's own notes.
create policy "Students add their own notes" on public.student_notes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (parent_id is null or exists (select 1 from public.student_notes p where p.id = parent_id and p.user_id = (select auth.uid())))
  );
create policy "Students change their own notes" on public.student_notes
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (parent_id is null or exists (select 1 from public.student_notes p where p.id = parent_id and p.user_id = (select auth.uid())))
  );
create policy "Students delete their own notes" on public.student_notes
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.student_notes to authenticated;

alter table public.profiles
  add column if not exists notes_active_at timestamptz,
  add column if not exists notes_warned_at timestamptz;

-- A note added or changed: its updated_at, and the student's year starts again.
create or replace function private.student_note_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  update public.profiles set notes_active_at = now(), notes_warned_at = null where id = new.user_id;
  return new;
end;
$$;
create trigger student_note_changed before insert or update on public.student_notes
  for each row execute function private.student_note_changed();

-- Opening /notes/ counts as using them.
create or replace function public.touch_my_notes()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set notes_active_at = now(), notes_warned_at = null
  where id = auth.uid() and exists (select 1 from public.student_notes n where n.user_id = auth.uid());
$$;
revoke execute on function public.touch_my_notes() from public, anon;
grant execute on function public.touch_my_notes() to authenticated;

-- Students with notes unused for 11 months and no warning yet: marked warned,
-- returned with the day their notes go (a year after last use, and never
-- sooner than 30 days after this email).
create or replace function public.claim_notes_warnings(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_people jsonb;
begin
  perform private.check_cron_secret(p_secret);
  with claimed as (
    update public.profiles p
    set notes_warned_at = now()
    where p.email is not null
      and p.notes_warned_at is null
      and p.notes_active_at < now() - interval '11 months'
      and exists (select 1 from public.student_notes n where n.user_id = p.id)
    returning p.id, p.full_name, p.email, p.site_language, p.notes_active_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'full_name', c.full_name,
    'email', c.email,
    'site_language', c.site_language,
    'notes', (select count(*) from public.student_notes n where n.user_id = c.id),
    'delete_on', greatest(c.notes_active_at + interval '1 year', now() + interval '30 days')
  )), '[]'::jsonb)
  into v_people
  from claimed c;
  return v_people;
end;
$$;

create or replace function public.unclaim_notes_warnings(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.profiles set notes_warned_at = null where id = any(p_ids);
end;
$$;

-- Notes unused for a year and warned about at least 30 days ago. Returns how
-- many students' notes were deleted.
create or replace function public.delete_stale_notes(p_secret text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform private.check_cron_secret(p_secret);
  select coalesce(array_agg(p.id), '{}') into v_ids
  from public.profiles p
  where p.notes_warned_at < now() - interval '30 days'
    and p.notes_active_at < now() - interval '1 year';
  delete from public.student_notes where user_id = any(v_ids);
  update public.profiles set notes_warned_at = null, notes_active_at = null where id = any(v_ids);
  return cardinality(v_ids);
end;
$$;

-- Like the other job functions: anyone may call, the secret guards them.
revoke execute on function public.claim_notes_warnings(text) from public;
revoke execute on function public.unclaim_notes_warnings(text, uuid[]) from public;
revoke execute on function public.delete_stale_notes(text) from public;
grant execute on function public.claim_notes_warnings(text) to anon, authenticated;
grant execute on function public.unclaim_notes_warnings(text, uuid[]) to anon, authenticated;
grant execute on function public.delete_stale_notes(text) to anon, authenticated;
