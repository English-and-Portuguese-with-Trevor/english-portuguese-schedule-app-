import type { LessonAccess, Role } from "@/lib/types";

/** The parts of the billing row the Settings page shows. */
export interface BillingSummary {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscription_id: string | null;
}

const LIVE = ["active", "trialing", "past_due"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * One or two sentences about the account's lesson access, worded the same as
 * the lessons and flashcards settings.
 */
export function accessSummary(
  role: Role,
  access: LessonAccess,
  billing: BillingSummary | null,
): string {
  if (role === "admin") return "Admin: every lesson is open.";
  if (access === "lifetime")
    return "Lifetime access: every lesson is yours for good.";
  if (access === "granted")
    return "Student access from Trevor: every lesson is included with your classes.";
  if (access === "subscriber") {
    const end = billing?.current_period_end
      ? formatDate(billing.current_period_end)
      : null;
    if (billing?.status === "past_due")
      return "Subscriber. Your last payment didn't go through; please update your card.";
    if (end && billing?.cancel_at_period_end)
      return `Subscriber. Canceled; your lessons stay open until ${end}.`;
    return end
      ? `Subscriber: every Portuguese lesson is open. Renews on ${end}.`
      : "Subscriber: every Portuguese lesson is open.";
  }
  return "Free lessons: lessons 1–4 are open. Subscribe on the lessons site, or ask Trevor for student access.";
}

/** Whether there is a Stripe subscription to manage (including an ended one, for receipts). */
export function hasSubscription(billing: BillingSummary | null): boolean {
  return Boolean(billing?.subscription_id);
}

export function isLiveSubscription(billing: BillingSummary | null): boolean {
  return LIVE.includes(billing?.status ?? "");
}
