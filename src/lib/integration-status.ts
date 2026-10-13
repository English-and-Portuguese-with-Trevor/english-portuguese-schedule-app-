import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * A client with no user session, for server work that isn't tied to a
 * signed-in person (the daily job, status records). Its database functions
 * are guarded by CRON_SECRET instead. It uses the service role key when
 * SUPABASE_SERVICE_ROLE_KEY is set (server only, so those functions can be
 * revoked from anon), and the anon key until then.
 */
export function createServerJobClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Records the Google connection's latest known state for the admin Overview. Never throws. */
export async function recordGoogleStatus(ok: boolean, message: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  try {
    const { error } = await createServerJobClient().rpc("record_integration_status", {
      p_secret: secret,
      p_service: "google",
      p_ok: ok,
      p_message: message,
    });
    if (error) console.error("[integration-status] could not record:", error.message);
  } catch (error) {
    console.error("[integration-status] could not record:", error);
  }
}
