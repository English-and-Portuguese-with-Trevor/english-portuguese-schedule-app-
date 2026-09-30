-- Reported issues on the lessons and activities sites: a student with lesson
-- access (granted, subscriber, lifetime) taps the flag on a lesson section
-- (1.2), an activity question or a page's "Report an issue", and picks a set
-- reason (no notes). Each report is a 'report' admin alert, handled like a
-- class flag: listed at once, pushed after a minute, in the morning email.
-- One report per student per item; tapping it again takes it back.

create table if not exists public.content_reports (
  user_id uuid not null references public.profiles(id) on delete cascade,
  site text not null check (site in ('lessons', 'activities')),
  item text not null check (length(item) between 1 and 200),
  reason text not null check (reason in ('mistake', 'answer', 'broken', 'other')),
  created_at timestamptz not null default now(),
  primary key (user_id, site, item)
);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from public, anon, authenticated;
grant select on public.content_reports to authenticated;
drop policy if exists content_reports_select_own on public.content_reports;
create policy content_reports_select_own on public.content_reports
  for select to authenticated using (user_id = auth.uid());

alter table public.admin_alerts drop constraint if exists admin_alerts_kind_check;
alter table public.admin_alerts
  add constraint admin_alerts_kind_check check (kind in ('signup', 'subscriber', 'flag', 'report'));
alter table public.admin_alerts add column if not exists item text;

create or replace function public.report_issue(p_site text, p_item text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lesson_access in ('granted', 'subscriber', 'lifetime')
  ) then
    raise exception 'Only students with lesson access can report issues.';
  end if;
  if p_reason is null or p_reason not in ('mistake', 'answer', 'broken', 'other') then
    raise exception 'Please pick a reason.';
  end if;

  insert into public.content_reports (user_id, site, item, reason)
  values (auth.uid(), p_site, p_item, p_reason)
  on conflict do nothing;
  if not found then
    raise exception 'You already reported this.';
  end if;

  insert into public.admin_alerts (kind, user_id, name, email, reason, item)
  select 'report', p.id, p.full_name, p.email, p_reason,
         case p_site when 'lessons' then 'Lessons' else 'Activities' end || ': ' || p_item
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

create or replace function public.unreport_issue(p_site text, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.content_reports
  where user_id = auth.uid() and site = p_site and item = p_item;
  delete from public.admin_alerts
  where kind = 'report' and user_id = auth.uid()
    and item = case p_site when 'lessons' then 'Lessons' else 'Activities' end || ': ' || p_item;
end;
$$;

revoke execute on function public.report_issue(text, text, text) from public, anon;
revoke execute on function public.unreport_issue(text, text) from public, anon;
grant execute on function public.report_issue(text, text, text) to authenticated;
grant execute on function public.unreport_issue(text, text) to authenticated;

-- Reports wait a minute before they're pushed, like class flags.
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
      and created_at > now() - interval '2 days'
      and not (kind in ('flag', 'report') and created_at > now() - interval '1 minute')
    returning id, kind, name, email, reason, class_start, item, created_at
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

create or replace function private.push_waiting_flags()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if not exists (
    select 1 from public.admin_alerts
    where kind in ('flag', 'report') and pushed_at is null
      and created_at <= now() - interval '1 minute'
      and created_at > now() - interval '2 days'
  ) then
    return;
  end if;
  select value into v_secret from private.app_settings where key = 'cron_secret';
  if v_secret is null then
    return;
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
end;
$$;

-- The morning email: class flags and reports not emailed yet.
create or replace function public.claim_flag_digest(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flags jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with claimed as (
    update public.admin_alerts
    set emailed_at = now()
    where kind in ('flag', 'report') and emailed_at is null
    returning id, kind, name, email, reason, class_start, item, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_flags
  from claimed;

  return v_flags;
end;
$$;
