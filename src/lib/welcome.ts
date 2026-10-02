import { isGoogleConfigured } from "@/lib/google";
import { createServerJobClient } from "@/lib/integration-status";
import { emails, sendNotification } from "@/lib/notifications";

type NewPerson = { id: string; full_name: string | null; email: string | null };

/**
 * Sends the welcome email to every new account not welcomed yet. Called
 * with the sign-up alert (/api/alerts/push) and by the daily job.
 * claim_welcome_emails marks them welcomed first, so two calls never send
 * one twice; a failed email hands the account back for the next call. While
 * Gmail isn't set up nothing is claimed, so they wait.
 */
export async function sendWelcomes(secret: string) {
  if (!isGoogleConfigured()) return 0;
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_welcome_emails", { p_secret: secret });
  if (error) throw new Error(`claim_welcome_emails: ${error.message}`);
  const people = (data ?? []) as unknown as NewPerson[];

  const failed: string[] = [];
  for (const person of people) {
    if (!(await sendNotification(emails.welcome(person)))) failed.push(person.id);
  }
  if (failed.length) {
    const { error: unclaimError } = await supabase.rpc("unclaim_welcome_emails", { p_secret: secret, p_ids: failed });
    if (unclaimError) console.error("[welcome] unclaim_welcome_emails failed; not welcomed:", failed, unclaimError.message);
  }
  return people.length - failed.length;
}
