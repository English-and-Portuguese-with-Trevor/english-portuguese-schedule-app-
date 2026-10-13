-- Alerts are emailed as well as pushed, so the database asks the schedule
-- app to send every new one, even when no device has push turned on. The
-- daily job sends any this call missed, so unsent alerts are kept for two
-- days instead of one.
create or replace function private.request_alert_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
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

revoke execute on function private.request_alert_push() from public, anon, authenticated;

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
