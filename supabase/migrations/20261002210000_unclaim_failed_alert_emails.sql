-- An alert counts as emailed only once the email went out. claim_alert_pushes
-- and claim_flag_digest mark alerts sent before the server emails them (so two
-- calls at once never send one twice); when the email fails, the server hands
-- the ids back with these, and the next call (the daily job at the latest, or
-- tomorrow's 6:30 AM flags email) sends them again.

-- Sign-ups and subscribers: claim_alert_pushes will pick them up again (within
-- its two-day window). Their push goes out again with the retried email.
create or replace function public.unclaim_alert_emails(p_secret text, p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.admin_alerts
  set pushed_at = null
  where id = any(p_ids) and kind not in ('flag', 'report');
end;
$$;

-- Flags and reports: the next morning email includes them again.
create or replace function public.unclaim_flag_digest(p_secret text, p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.admin_alerts
  set emailed_at = null
  where id = any(p_ids) and kind in ('flag', 'report');
end;
$$;

-- Same as the claim functions: the server's job client uses the anon key and
-- passes CRON_SECRET.
revoke execute on function public.unclaim_alert_emails(text, bigint[]) from public;
revoke execute on function public.unclaim_flag_digest(text, bigint[]) from public;
grant execute on function public.unclaim_alert_emails(text, bigint[]) to anon, authenticated;
grant execute on function public.unclaim_flag_digest(text, bigint[]) to anon, authenticated;
