-- The push (VAPID) key pair is made by the schedule app's server the first
-- time the admin turns push on, and stored here once; nobody has to copy keys
-- into a dashboard. An existing pair is never replaced, since that would cut
-- off every device already subscribed.
create or replace function public.set_vapid_keys(p_secret text, p_public text, p_private text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  if exists (select 1 from private.app_settings where key in ('vapid_public_key', 'vapid_private_key')) then
    return;
  end if;
  insert into private.app_settings (key, value)
  values ('vapid_public_key', p_public), ('vapid_private_key', p_private);
end;
$$;

revoke execute on function public.set_vapid_keys(text, text, text) from public;
grant execute on function public.set_vapid_keys(text, text, text) to anon, authenticated;
