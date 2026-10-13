-- Daily practice (Trevor, 2026-10-08): students with lesson access pick
-- lessons (or Trevor picks them on the admin dashboard), and the activities
-- site's #/daily makes a set of `size` questions a day (5 to 25, 10 by
-- default) from those lessons' topics, at least a fifth of it questions they
-- missed (review_items). A push reminder goes out once a day at `push_hour`
-- in the student's time zone (profiles.timezone), to every device the
-- student turned it on for, unless that day's set is already done.
--
-- The devices are kept apart from the admin's push_subscriptions, so an
-- admin alert never reaches a student. The VAPID keys are the same ones
-- (private.app_settings); never replace them.

create table if not exists public.daily_practice (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  lessons text[] not null default '{}' check (cardinality(lessons) <= 100),
  size smallint not null default 10 check (size between 5 and 25),
  push_hour smallint not null default 9 check (push_hour between 0 and 23),
  -- Days in the student's time zone: the set finished, the reminder sent.
  done_on date,
  pushed_on date,
  updated_at timestamptz not null default now()
);

alter table public.daily_practice enable row level security;
revoke all on public.daily_practice from public, anon, authenticated;
grant select, insert, update (user_id, lessons, size, push_hour, updated_at) on public.daily_practice to authenticated;
grant all on public.daily_practice to service_role;

-- The student and admins read and set it.
create policy daily_practice_select on public.daily_practice
  for select to authenticated using (user_id = auth.uid() or private.is_admin());
create policy daily_practice_insert on public.daily_practice
  for insert to authenticated with check (user_id = auth.uid() or private.is_admin());
create policy daily_practice_update on public.daily_practice
  for update to authenticated using (user_id = auth.uid() or private.is_admin())
  with check (user_id = auth.uid() or private.is_admin());

-- The day's set is done, in the student's time zone (so the reminder skips it).
create or replace function public.finish_daily_practice()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.daily_practice d
  set done_on = (now() at time zone coalesce(
    (select tz.name from public.profiles p join pg_catalog.pg_timezone_names tz on tz.name = p.timezone where p.id = d.user_id),
    'America/Denver'))::date
  where d.user_id = auth.uid();
$$;

revoke execute on function public.finish_daily_practice() from public, anon;
grant execute on function public.finish_daily_practice() to authenticated;

-- The students' devices. Only the functions below touch it.
create table if not exists public.practice_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.practice_push_subscriptions enable row level security;
revoke all on public.practice_push_subscriptions from public, anon, authenticated;

-- The public key a device subscribes with (public by nature).
create or replace function public.practice_push_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from private.app_settings where key = 'vapid_public_key';
$$;

create or replace function public.save_practice_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Log in first';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'Not a push endpoint.';
  end if;
  insert into public.practice_push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

-- Whether this device gets the reminder (the switch in the settings).
create or replace function public.has_practice_push(p_endpoint text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.practice_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid());
$$;

create or replace function public.delete_practice_push(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.practice_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.practice_push_key(), public.save_practice_push(text, text, text),
  public.has_practice_push(text), public.delete_practice_push(text) from public, anon;
grant execute on function public.practice_push_key(), public.save_practice_push(text, text, text),
  public.has_practice_push(text), public.delete_practice_push(text) to authenticated;

-- For the schedule app (CRON_SECRET): the reminders due this hour, marked
-- sent first so two calls never send one twice. Only students with lesson
-- access, lessons picked, the set not done today and their hour now.
create or replace function public.claim_practice_pushes(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pushes jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with due as (
    select d.user_id, (now() at time zone tz.name)::date as today
    from public.daily_practice d
    join public.profiles p on p.id = d.user_id
    join pg_catalog.pg_timezone_names tz on tz.name = coalesce(p.timezone, 'America/Denver')
    where cardinality(d.lessons) > 0
      and (p.lesson_access in ('granted', 'subscriber', 'lifetime') or p.role = 'admin')
      and extract(hour from now() at time zone tz.name) = d.push_hour
      and d.pushed_on is distinct from (now() at time zone tz.name)::date
      and d.done_on is distinct from (now() at time zone tz.name)::date
      and exists (select 1 from public.practice_push_subscriptions s where s.user_id = d.user_id)
  ), claimed as (
    update public.daily_practice d
    set pushed_on = due.today
    from due
    where d.user_id = due.user_id
    returning d.user_id, d.size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
    'size', c.size, 'site_language', p.site_language
  )), '[]'::jsonb)
  into v_pushes
  from claimed c
  join public.practice_push_subscriptions s on s.user_id = c.user_id
  join public.profiles p on p.id = c.user_id;

  return jsonb_build_object(
    'pushes', v_pushes,
    'vapid_public_key', (select value from private.app_settings where key = 'vapid_public_key'),
    'vapid_private_key', (select value from private.app_settings where key = 'vapid_private_key')
  );
end;
$$;

create or replace function public.drop_practice_push(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  delete from public.practice_push_subscriptions where endpoint = p_endpoint;
end;
$$;

-- The schedule app calls these with the anon key; CRON_SECRET guards them.
grant execute on function public.claim_practice_pushes(text), public.drop_practice_push(text, text) to anon, authenticated;

-- Run by pg_cron a few minutes past every hour: asks the schedule app to
-- send the reminders when any device wants them.
create or replace function private.request_practice_pushes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if not exists (select 1 from public.practice_push_subscriptions) then
    return;
  end if;
  select value into v_secret from private.app_settings where key = 'cron_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://schedule.englishandportuguesewithtrevor.com/api/practice/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function private.request_practice_pushes() from public, anon, authenticated;

select cron.schedule('practice-pushes', '3 * * * *', 'select private.request_practice_pushes()');
