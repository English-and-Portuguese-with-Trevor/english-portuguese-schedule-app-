/** Alerts for the admin (new sign-ups, new subscribers, flagged classes, reported issues): shared by the Alerts page and the push sender. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import type { Database } from "@/lib/supabase/database.types";
import { FLAG_REASONS, type FlagReason } from "@/lib/types";

export type AlertRow = {
  id: number;
  kind: "signup" | "subscriber" | "flag" | "report";
  name: string | null;
  email: string | null;
  created_at: string;
  /** Flags and reports: the reason the student picked, and the class time or the lesson/activity. */
  reason?: string | null;
  class_start?: string | null;
  item?: string | null;
};

/** The reasons students pick when reporting an issue on the lessons or activities site (report_issue). */
const REPORT_REASONS: Record<string, string> = {
  mistake: "Mistake in the text",
  answer: "Wrong answer or grading",
  broken: "Something doesn't work",
  other: "Something else",
};

export function alertTitle(kind: AlertRow["kind"]) {
  if (kind === "flag") return "Class flagged";
  if (kind === "report") return "Issue reported";
  return kind === "subscriber" ? "New subscriber" : "New sign-up";
}

/**
 * "Connection or Meet problem · class Mon, Sep 28, 2:30 PM MDT" (in the
 * admin's Mountain time), or for a report "Mistake in the text · Lessons: …".
 */
export function flagDetails(alert: Pick<AlertRow, "kind" | "reason" | "class_start" | "item">) {
  if (alert.kind === "report") {
    return [REPORT_REASONS[alert.reason ?? ""] ?? alert.reason, alert.item].filter(Boolean).join(" · ");
  }
  return [
    FLAG_REASONS[alert.reason as FlagReason] ?? alert.reason,
    alert.class_start &&
      `class ${formatInTimeZone(new Date(alert.class_start), "America/Denver", "EEE, MMM d, h:mm a zzz")}`,
  ]
    .filter(Boolean)
    .join(" · ");
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
        alert.kind === "flag" || alert.kind === "report"
          ? `${who(alert)}: ${flagDetails(alert)}`
          : alert.kind === "subscriber"
            ? `${who(alert)} subscribed to the lessons.`
            : `${who(alert)} created an account.`,
      tag: `alert-${alert.id}`,
      url: "/admin/alerts",
    };
  }
  const count = (kind: AlertRow["kind"]) => alerts.filter((a) => a.kind === kind).length;
  const [signups, subscribers, flags, reports] = [count("signup"), count("subscriber"), count("flag"), count("report")];
  const parts = [
    flags && `${flags} flagged class${flags === 1 ? "" : "es"}`,
    reports && `${reports} reported issue${reports === 1 ? "" : "s"}`,
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
