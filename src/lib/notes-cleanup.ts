import { isGoogleConfigured } from "@/lib/google";
import { createServerJobClient } from "@/lib/integration-status";
import { emails, sendNotification, type NotesOwner } from "@/lib/notifications";

/**
 * Daily: students' notes (the landing site's /notes/) are kept a year from
 * their last use. Students whose notes nobody opened or changed for 11
 * months get one warning email (claim_notes_warnings marks them first; a
 * failed email hands them back), and notes a year unused, warned at least
 * 30 days ago, are deleted. While Gmail isn't set up nothing is claimed or
 * deleted, so no one loses notes without the email.
 */
export async function cleanUpNotes(secret: string) {
  if (!isGoogleConfigured()) return { warned: 0, deleted: 0 };
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_notes_warnings", { p_secret: secret });
  if (error) throw new Error(`claim_notes_warnings: ${error.message}`);
  const people = (data ?? []) as unknown as NotesOwner[];

  const failed: string[] = [];
  for (const person of people) {
    if (!(await sendNotification(emails.notesExpiring(person)))) failed.push(person.id);
  }
  if (failed.length) {
    const { error: unclaimError } = await supabase.rpc("unclaim_notes_warnings", { p_secret: secret, p_ids: failed });
    if (unclaimError) console.error("[notes-cleanup] unclaim_notes_warnings failed; not sent:", failed, unclaimError.message);
  }

  const { data: deleted, error: deleteError } = await supabase.rpc("delete_stale_notes", { p_secret: secret });
  if (deleteError) throw new Error(`delete_stale_notes: ${deleteError.message}`);
  return { warned: people.length - failed.length, deleted: deleted ?? 0 };
}
