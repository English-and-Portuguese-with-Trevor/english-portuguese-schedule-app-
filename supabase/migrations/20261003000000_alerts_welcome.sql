-- Alerts, leftovers, and the welcome email (Trevor, 2026-10-02).
-- Not applied yet: Trevor runs it in the SQL editor, then the schedule app's
-- waiting-on-sql branch is merged into main.

-- 1. Push and email are marked separately for sign-ups and subscribers.
-- pushed_at marks the push only; emailed_at (until now used by flags and
-- reported issues alone) marks the email. So a failed email is retried
-- without pushing again, and the email is retried for 14 days (the push
-- window stays 2 days).

-- Alerts already sent (pushed and emailed together) count as emailed.
update public.admin_alerts
set emailed_at = pushed_at
where kind not in ('flag', 'report') and emailed_at is null and pushed_at is not null;

create or replace function public.claim_alert_pushes(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerts jsonb;
  v_emails jsonb;
begin
  perform private.check_cron_secret(p_secret);

  -- To push: every kind; flags and reports wait a minute first.
  with claimed as (
    update public.admin_alerts
    set pushed_at = now()
    where pushed_at is null
      and created_at > now() - interval '2 days'
      and not (kind in ('flag', 'report') and created_at > now() - interval '1 minute')
    returning id, kind, name, email, reason, class_start, item, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_alerts
  from claimed;

  -- To email now: sign-ups and subscribers (flags and reports wait for the
  -- morning email, claim_flag_digest).
  with claimed as (
    update public.admin_alerts
    set emailed_at = now()
    where emailed_at is null
      and kind not in ('flag', 'report')
      and created_at > now() - interval '14 days'
    returning id, kind, name, email, reason, class_start, item, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_emails
  from claimed;

  return jsonb_build_object(
    'alerts', v_alerts,
    'emails', v_emails,
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

-- A failed email hands its alerts back for the next call; the push stays done.
create or replace function public.unclaim_alert_emails(p_secret text, p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.admin_alerts
  set emailed_at = null
  where id = any(p_ids) and kind not in ('flag', 'report');
end;
$$;

-- 2. Welcome email: sent once per account, right after sign-up.
alter table public.profiles add column if not exists welcomed_at timestamptz;

-- Accounts made before today never get it.
update public.profiles set welcomed_at = now() where welcomed_at is null;

-- Claims the accounts not welcomed yet (made in the last 14 days, with an
-- email), marking them welcomed first so two calls never send one twice.
create or replace function public.claim_welcome_emails(p_secret text)
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
    update public.profiles
    set welcomed_at = now()
    where welcomed_at is null
      and email is not null
      and created_at > now() - interval '14 days'
    returning id, full_name, email
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb)
  into v_people
  from claimed;

  return v_people;
end;
$$;

-- A failed welcome email hands the account back, so the next call sends it.
create or replace function public.unclaim_welcome_emails(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.profiles set welcomed_at = null where id = any(p_ids);
end;
$$;

-- Like the other job functions: anyone may call, the secret guards them.
revoke execute on function public.claim_welcome_emails(text) from public;
revoke execute on function public.unclaim_welcome_emails(text, uuid[]) from public;
grant execute on function public.claim_welcome_emails(text) to anon, authenticated;
grant execute on function public.unclaim_welcome_emails(text, uuid[]) to anon, authenticated;
