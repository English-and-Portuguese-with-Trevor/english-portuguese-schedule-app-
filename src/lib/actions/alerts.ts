"use server";

import { revalidatePath } from "next/cache";

import { createVapidKeys } from "@/lib/admin-push";
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

/** The public key browsers subscribe with; made on first use. */
export async function getPushPublicKey(): Promise<{ key: string | null; error: string | null }> {
  const supabase = await requireAdmin();
  const read = () => supabase.rpc("vapid_public_key");

  let { data, error } = await read();
  if (error) return { key: null, error: error.message };
  if (!data) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return { key: null, error: "Push isn't set up on the server (CRON_SECRET is missing)." };
    try {
      await createVapidKeys(secret);
    } catch (err) {
      return { key: null, error: err instanceof Error ? err.message : String(err) };
    }
    ({ data, error } = await read());
    if (error) return { key: null, error: error.message };
  }
  return { key: data, error: null };
}

export async function savePushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
    p_user_agent: subscription.userAgent,
  });
  return { error: error?.message ?? null };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return { error: error?.message ?? null };
}
