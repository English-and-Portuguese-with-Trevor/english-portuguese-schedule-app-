-- Who can open paid lessons: 'granted' is set by Trevor by hand (current and
-- legacy students), 'subscriber' will be set by the Stripe webhook.
alter table public.profiles
  add column lesson_access text not null default 'none'
  check (lesson_access in ('none', 'granted', 'subscriber'));

-- Everyone with an account today is an existing student.
update public.profiles set lesson_access = 'granted';

create or replace function private.has_lesson_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.lesson_access in ('granted', 'subscriber') or p.role = 'admin')
  );
$$;

revoke all on function private.has_lesson_access() from public, anon;
grant execute on function private.has_lesson_access() to authenticated;

-- Text of paid lessons. Only readable by accounts with access; written by the
-- lessons repo's sync step with the service role key.
create table public.lesson_content (
  id text primary key,
  blocks jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lesson_content enable row level security;

revoke all on public.lesson_content from anon, authenticated;
grant select on public.lesson_content to authenticated;

create policy lesson_content_select on public.lesson_content
  for select to authenticated
  using (private.has_lesson_access());
