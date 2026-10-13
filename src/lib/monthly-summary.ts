import { isGoogleConfigured } from "@/lib/google";
import { createServerJobClient } from "@/lib/integration-status";
import { emails, sendNotification, type LessonCatalog, type MonthlySummary } from "@/lib/notifications";

const LESSONS_URL = "https://englishandportuguesewithtrevor.com/lessons/lessons.json";

/**
 * On the 1st (the daily job), emails every student who did anything last
 * month their summary. claim_monthly_summaries marks them first, so a second
 * run never sends twice; a failed email hands the student back for the next
 * run. While Gmail isn't set up nothing is claimed.
 */
export async function sendMonthlySummaries(secret: string) {
  if (!isGoogleConfigured()) return 0;
  const catalog: LessonCatalog = await fetch(LESSONS_URL)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_monthly_summaries", { p_secret: secret });
  if (error) throw new Error(`claim_monthly_summaries: ${error.message}`);
  const people = (data ?? []) as unknown as MonthlySummary[];

  const failed: string[] = [];
  for (const person of people) {
    if (!(await sendNotification(emails.monthlySummary(person, catalog)))) failed.push(person.id);
  }
  if (failed.length) {
    const { error: unclaimError } = await supabase.rpc("unclaim_monthly_summaries", { p_secret: secret, p_ids: failed });
    if (unclaimError) console.error("[monthly] unclaim_monthly_summaries failed; not sent:", failed, unclaimError.message);
  }
  return people.length - failed.length;
}
