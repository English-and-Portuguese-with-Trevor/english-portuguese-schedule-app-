import { isGoogleConfigured } from "@/lib/google";
import { createServerJobClient } from "@/lib/integration-status";
import { emails, sendNotification, type ClassUpdate } from "@/lib/notifications";

/**
 * On Sundays (the daily job), emails each private student with a class in
 * the week starting `week` (a Denver date) their weekly class update.
 * claim_class_updates marks them first, so a second run never sends twice;
 * a failed email hands the student back for the next run. While Gmail isn't
 * set up nothing is claimed.
 */
export async function sendClassUpdates(secret: string, week: string) {
  if (!isGoogleConfigured()) return 0;
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_class_updates", { p_secret: secret, p_week: week });
  if (error) throw new Error(`claim_class_updates: ${error.message}`);
  const people = (data ?? []) as unknown as ClassUpdate[];

  const failed: string[] = [];
  for (const person of people) {
    if (!(await sendNotification(emails.weeklyClassUpdate(person)))) failed.push(person.id);
  }
  if (failed.length) {
    const { error: unclaimError } = await supabase.rpc("unclaim_class_updates", { p_secret: secret, p_ids: failed });
    if (unclaimError) console.error("[class-updates] unclaim_class_updates failed; not sent:", failed, unclaimError.message);
  }
  return people.length - failed.length;
}
