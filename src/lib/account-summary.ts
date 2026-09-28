import { formatFullDate } from "@/i18n/format";
import { translator, type Translate } from "@/i18n/translate";
import type { SiteLanguage } from "@/lib/prefs";
import type { LessonAccess, Role } from "@/lib/types";

/** The parts of the billing row the Settings page shows. */
export interface BillingSummary {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscription_id: string | null;
}

const LIVE = ["active", "trialing", "past_due"];

/**
 * One or two sentences about the account's lesson access, worded the same as
 * the lessons and flashcards settings.
 */
export function accessSummary(
  role: Role,
  access: LessonAccess,
  billing: BillingSummary | null,
  lang: SiteLanguage = "en",
): string {
  const t: Translate = translator(lang);
  if (role === "admin") return t("Admin: every lesson is open.");
  if (access === "lifetime")
    return t("Lifetime access: every lesson is yours for good.");
  if (access === "granted")
    return t(
      "Student access from Trevor: every lesson is included with your classes.",
    );
  if (access === "subscriber") {
    const end = billing?.current_period_end
      ? formatFullDate(billing.current_period_end, lang)
      : null;
    if (billing?.status === "past_due")
      return t(
        "Subscriber. Your last payment didn't go through; please update your card.",
      );
    if (end && billing?.cancel_at_period_end)
      return t("Subscriber. Canceled; your lessons stay open until {date}.", {
        date: end,
      });
    return end
      ? t("Subscriber: every lesson is open, in both languages. Renews on {date}.", {
          date: end,
        })
      : t("Subscriber: every lesson is open, in both languages.");
  }
  return t(
    "Free lessons: lessons 1–4 are open. Subscribe on the lessons site, or ask Trevor for student access.",
  );
}

/** Whether there is a Stripe subscription to manage (including an ended one, for receipts). */
export function hasSubscription(billing: BillingSummary | null): boolean {
  return Boolean(billing?.subscription_id);
}

export function isLiveSubscription(billing: BillingSummary | null): boolean {
  return LIVE.includes(billing?.status ?? "");
}
