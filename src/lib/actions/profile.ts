"use server";

import { createClient } from "@/lib/supabase/server";

/** Saves the signed-in user's browser time zone (unknown zone names are ignored by the database). */
export async function setMyTimezone(timezone: string) {
  const supabase = await createClient();
  await supabase.rpc("set_my_timezone", { p_timezone: timezone });
}
