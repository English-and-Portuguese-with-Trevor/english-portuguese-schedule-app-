-- Try something new pill stats (Trevor, 2026-10-04): every pill shown, tapped
-- or closed (the x) is logged, so the Monday summary can show how students
-- use them. Students only add their own rows (log_pill_event); admins read.
create table if not exists public.pill_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  site text not null check (site in ('lessons', 'flashcards', 'activities', 'dailies')),
  action text not null check (action in ('shown', 'tap', 'close')),
  pill text not null check (pill in ('suggestion', 'unlock')),
  target text,
  created_at timestamptz not null default now()
);
create index if not exists pill_events_created_at on public.pill_events (created_at);
create index if not exists pill_events_user_id on public.pill_events (user_id);
alter table public.pill_events enable row level security;
drop policy if exists pill_events_admin_read on public.pill_events;
create policy pill_events_admin_read on public.pill_events for select to authenticated using (private.is_admin());

create or replace function public.log_pill_event(p_site text, p_action text, p_pill text, p_target text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.pill_events (user_id, site, action, pill, target)
  values (auth.uid(), p_site, p_action, p_pill, left(p_target, 200));
  delete from public.pill_events where created_at < now() - interval '180 days';
end;
$$;
revoke execute on function public.log_pill_event(text, text, text, text) from public, anon;
grant execute on function public.log_pill_event(text, text, text, text) to authenticated;

-- The last 7 days for the Monday summary (cron secret, like weekly_summary).
create or replace function public.pill_stats(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  return (
    select jsonb_build_object(
      'shown', count(*) filter (where e.action = 'shown'),
      'tapped', count(*) filter (where e.action = 'tap' and e.pill = 'suggestion'),
      'closed', count(*) filter (where e.action = 'close'),
      'unlock_shown', count(*) filter (where e.action = 'shown' and e.pill = 'unlock'),
      'unlock_tapped', count(*) filter (where e.action = 'tap' and e.pill = 'unlock'),
      'students', count(distinct e.user_id)
    )
    from public.pill_events e
    join public.profiles p on p.id = e.user_id and p.role <> 'admin'
    where e.created_at > now() - interval '7 days'
  );
end;
$$;
revoke execute on function public.pill_stats(text) from public;
grant execute on function public.pill_stats(text) to anon, authenticated;
