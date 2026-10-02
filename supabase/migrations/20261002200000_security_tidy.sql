-- Security tidy-up from the 2026-10-02 audit (Trevor approved).
--
-- 1. private.app_settings (the VAPID keys) gets row-level security with no
--    policies. Only SECURITY DEFINER functions owned by postgres read it
--    (claim_alert_pushes, test_push_target, set_vapid_keys, vapid_public_key,
--    private.check_cron_secret, private.request_alert_push,
--    private.push_waiting_flags), and the owner isn't subject to RLS, so they
--    keep working; anything else now sees no rows.
alter table private.app_settings enable row level security;

-- 2. set_vapid_keys was a one-time setup call and nothing in the app calls it;
--    the keys must never be replaced. Only the database owner can run it now.
--    The other secret-guarded job functions (claim_*, admin_agenda,
--    record_integration_status, set_booking_meeting, drop_push_subscription,
--    test_push_target) stay callable by anon: the server's job client
--    (createServerJobClient) uses the anon key and passes CRON_SECRET.
revoke execute on function public.set_vapid_keys(text, text, text) from public, anon, authenticated;

-- 3. profiles had two identical SELECT policies; keep profiles_select
--    (private.is_admin(), same as profiles_update). Trevor ran this one in
--    the SQL editor on 2026-10-02.
drop policy if exists profiles_select_own_or_admin on public.profiles;
