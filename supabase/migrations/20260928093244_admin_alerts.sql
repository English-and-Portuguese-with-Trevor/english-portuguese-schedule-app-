-- Alerts for the admin: a row for every new account and every new Stripe
-- subscriber, listed on /admin/alerts (with the unread count on the bell in
-- the header) and sent as a push notification to every device the admin
-- turned push on for.
--
-- Push: a new alert asks the schedule app's /api/alerts/push route to send it
-- (pg_net, after the transaction commits, so a signup or a Stripe webhook is
-- never slowed down or blocked by it). The route proves itself with the job
-- secret (private.app_settings 'cron_secret') and gets the unsent alerts, the
-- devices and the VAPID keys (private.app_settings 'vapid_public_key',
-- 'vapid_private_key') from claim_alert_pushes.

create extension if not exists pg_net with schema extensions;

create table if not exists public.admin_alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('signup', 'subscriber')),
  -- Deleting an account deletes its alerts, so nothing about it is kept.
  user_id uuid references public.profiles(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);

create index if not exists admin_alerts_created_at on public.admin_alerts (created_at desc);
create index if not exists admin_alerts_unread on public.admin_alerts (id) where read_at is null;
create index if not exists admin_alerts_unpushed on public.admin_alerts (id) where pushed_at is null;

alter table public.admin_alerts enable row level security;

drop policy if exists admin_alerts_select on public.admin_alerts;
create policy admin_alerts_select on public.admin_alerts
  for select to authenticated using (private.is_admin());

drop policy if exists admin_alerts_update on public.admin_alerts;
create policy admin_alerts_update on public.admin_alerts
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

revoke all on public.admin_alerts from public, anon, authenticated;
grant select on public.admin_alerts to authenticated;
-- Admins can only mark alerts read; rows are written by the triggers below.
grant update (read_at) on public.admin_alerts to authenticated;

-- The devices that get push notifications. Only the functions below touch it.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;

-- Triggers --------------------------------------------------------------

create or replace function private.alert_new_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where id = new.id;
  insert into public.admin_alerts (kind, user_id, name, email)
  values (
    'signup',
    new.id,
    coalesce(
      nullif(trim(new.full_name), ''),
      nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(v_user.raw_user_meta_data ->> 'name'), '')
    ),
    coalesce(new.email, v_user.email)
  );
  return new;
exception when others then
  -- An alert is never worth failing a signup over.
  raise warning 'alert_new_signup: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists profiles_alert_new_signup on public.profiles;
create trigger profiles_alert_new_signup
  after insert on public.profiles
  for each row execute function private.alert_new_signup();

-- A subscription that starts (or starts again after ending). Stripe's status
-- moving between live states (active, trialing, past_due, unpaid) is not new.
create or replace function private.alert_new_subscriber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('active', 'trialing')
     and (tg_op = 'INSERT' or old.status is null
          or old.status not in ('active', 'trialing', 'past_due', 'unpaid')) then
    insert into public.admin_alerts (kind, user_id, name, email)
    select 'subscriber', p.id, p.full_name, p.email
    from public.profiles p
    where p.id = new.user_id;
  end if;
  return new;
exception when others then
  raise warning 'alert_new_subscriber: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists billing_alert_new_subscriber on public.billing;
create trigger billing_alert_new_subscriber
  after insert or update of status on public.billing
  for each row execute function private.alert_new_subscriber();

-- Asks the schedule app to push the new alert, when any device wants pushes.
create or replace function private.request_alert_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions) then
    return null;
  end if;
  select value into v_secret from private.app_settings where key = 'cron_secret';
  if v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := 'https://schedule.englishandportuguesewithtrevor.com/api/alerts/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  raise warning 'request_alert_push: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists admin_alerts_request_push on public.admin_alerts;
create trigger admin_alerts_request_push
  after insert on public.admin_alerts
  for each statement execute function private.request_alert_push();

revoke execute on function private.alert_new_signup() from public, anon, authenticated;
revoke execute on function private.alert_new_subscriber() from public, anon, authenticated;
revoke execute on function private.request_alert_push() from public, anon, authenticated;

-- Functions for the admin's browser --------------------------------------

create or replace function public.vapid_public_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin only';
  end if;
  return (select value from private.app_settings where key = 'vapid_public_key');
end;
$$;

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'Not a push endpoint.';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh,
        auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.vapid_public_key() from public, anon;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.vapid_public_key() to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- Functions for the server (guarded by the job secret) --------------------

-- Marks the unsent alerts of the last day as sent and returns them, with the
-- admins' devices and the VAPID keys. Claiming first means two requests
-- arriving together never send an alert twice.
create or replace function public.claim_alert_pushes(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerts jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with claimed as (
    update public.admin_alerts
    set pushed_at = now()
    where pushed_at is null
      and created_at > now() - interval '1 day'
    returning id, kind, name, email, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_alerts
  from claimed;

  return jsonb_build_object(
    'alerts', v_alerts,
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s
      join public.profiles p on p.id = s.user_id and p.role = 'admin'
    ), '[]'::jsonb),
    'vapid_public_key', (select value from private.app_settings where key = 'vapid_public_key'),
    'vapid_private_key', (select value from private.app_settings where key = 'vapid_private_key')
  );
end;
$$;

-- For devices the push service says are gone (the admin turned notifications
-- off, or uninstalled the browser).
create or replace function public.drop_push_subscription(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke execute on function public.claim_alert_pushes(text) from public;
revoke execute on function public.drop_push_subscription(text, text) from public;
grant execute on function public.claim_alert_pushes(text) to anon, authenticated;
grant execute on function public.drop_push_subscription(text, text) to anon, authenticated;
