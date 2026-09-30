-- Test notifications from the admin dashboard: the push keys and one saved
-- device, looked up by its endpoint, so a test can only reach a device that
-- already turned push on (never an arbitrary address). Reads only; guarded by
-- the same cron secret as the other push functions.
create or replace function public.test_push_target(p_secret text, p_endpoint text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  return (
    select jsonb_build_object(
      'endpoint', s.endpoint,
      'p256dh', s.p256dh,
      'auth', s.auth,
      'vapid_public_key', (select value from private.app_settings where key = 'vapid_public_key'),
      'vapid_private_key', (select value from private.app_settings where key = 'vapid_private_key')
    )
    from public.push_subscriptions s
    where s.endpoint = p_endpoint
  );
end;
$$;

revoke execute on function public.test_push_target(text, text) from public;
grant execute on function public.test_push_target(text, text) to anon, authenticated;
