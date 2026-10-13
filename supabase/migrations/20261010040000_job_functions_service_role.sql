-- Security audit (2026-10-10): the secret-guarded job functions (claim_*,
-- unclaim_*, weekly_summary, admin_agenda, delete_stale_notes,
-- test_push_target, set_booking_meeting, ...) were callable by anon and
-- authenticated, so the cron secret alone unlocked every student's data and
-- the push keys from the public API. The schedule app now calls them with
-- the service role key (SUPABASE_SERVICE_ROLE_KEY in Vercel,
-- createServerJobClient in src/lib/integration-status.ts), so only that
-- role may run them; check_cron_secret stays as the second lock.
-- admin_timezone() is read by the same client, so it moves with them.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proname = 'admin_timezone' or 'p_secret' = any (p.proargnames))
  loop
    execute format('grant execute on function %s to service_role', f.sig);
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end;
$$;
