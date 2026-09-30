"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  return supabase;
}

/** Marks every alert read (the Alerts page does this when opened), which clears the bell. */
export async function markAlertsRead(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { error: null };
}
