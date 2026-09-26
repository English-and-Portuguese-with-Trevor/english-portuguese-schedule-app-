import { checkGoogleConnection } from "@/lib/google";
import { createServerJobClient, recordGoogleStatus } from "@/lib/integration-status";
import { emails, sendNotification } from "@/lib/notifications";

/**
 * Runs once a day (see vercel.json): checks the Google connection, sends
 * each student one reminder for lessons in the next 36 hours, and sends the
 * admin the day's agenda. The database functions it calls are guarded by
 * the same CRON_SECRET the request was authorized with.
 */
export async function runDailyJob(secret: string) {
  const google = await checkGoogleConnection();
  await recordGoogleStatus(google.ok, google.ok ? "Daily check passed." : google.message);
  // Leave reminders unclaimed while Google is down, so tomorrow's run can still send them.
  if (!google.ok) return { google: google.message, reminders: 0, agenda: false };

  const supabase = createServerJobClient();
  const { data: adminZone } = await supabase.rpc("admin_timezone");

  const { data: due, error: remindersError } = await supabase.rpc("claim_student_reminders", { p_secret: secret });
  if (remindersError) throw new Error(`claim_student_reminders: ${remindersError.message}`);
  for (const row of due ?? []) {
    await sendNotification(
      emails.reminder(
        {
          bookingId: row.booking_id,
          start: row.start_time,
          end: row.end_time,
          studentName: row.student_name,
          studentEmail: row.student_email,
          studentTimezone: row.student_timezone,
        },
        row.meet_link || null,
      ),
    );
  }

  const { data: agenda, error: agendaError } = await supabase.rpc("admin_agenda", { p_secret: secret });
  if (agendaError) throw new Error(`admin_agenda: ${agendaError.message}`);
  const agendaEmail = emails.adminAgenda(
    (agenda ?? []).map((row) => ({
      status: row.status,
      start: row.start_time,
      end: row.end_time,
      studentName: row.student_name,
      studentTimezone: row.student_timezone,
      language: row.lesson_language,
      whatsapp: row.whatsapp,
      rescheduleFrom: row.reschedule_from,
    })),
    adminZone || "America/Denver",
  );
  await sendNotification(agendaEmail);

  return { google: "ok", reminders: due?.length ?? 0, agenda: agendaEmail !== null };
}
