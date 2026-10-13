"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";

type ActionResult = { error: string | null };


/** Marks every alert read (the Alerts page does this when opened), which clears the bell. */
export async function markAlertsRead(): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { error: null };
}
