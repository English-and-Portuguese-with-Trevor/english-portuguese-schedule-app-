/** Alerts for the admin (new sign-ups, new subscribers): shared by the Alerts page and the push sender. */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type AlertRow = {
  id: number;
  kind: "signup" | "subscriber";
  name: string | null;
  email: string | null;
  created_at: string;
};

export function alertTitle(kind: AlertRow["kind"]) {
  return kind === "subscriber" ? "New subscriber" : "New sign-up";
}

export function who(alert: Pick<AlertRow, "name" | "email">) {
  if (alert.name && alert.email) return `${alert.name} (${alert.email})`;
  return alert.name || alert.email || "Someone";
}

/** One notification per batch: the alert itself, or a count when several arrived together. */
export function pushMessage(alerts: AlertRow[]) {
  if (alerts.length === 1) {
    const [alert] = alerts;
    return {
      title: alertTitle(alert.kind),
      body:
        alert.kind === "subscriber"
          ? `${who(alert)} subscribed to the lessons.`
          : `${who(alert)} created an account.`,
      tag: `alert-${alert.id}`,
      url: "/admin/alerts",
    };
  }
  const signups = alerts.filter((a) => a.kind === "signup").length;
  const subscribers = alerts.length - signups;
  const parts = [
    signups && `${signups} new sign-up${signups === 1 ? "" : "s"}`,
    subscribers && `${subscribers} new subscriber${subscribers === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return {
    title: `${alerts.length} new alerts`,
    body: parts.join(", "),
    tag: "alerts",
    url: "/admin/alerts",
  };
}

/** The number on the header's bell. Only admins can read alerts, so anyone else gets 0. */
export async function unreadAlertCount(supabase: SupabaseClient<Database>, role: string) {
  if (role !== "admin") return 0;
  const { count } = await supabase
    .from("admin_alerts")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}
