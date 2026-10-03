import { sendAlerts } from "@/lib/admin-push";
import { sendWelcomes } from "@/lib/welcome";
import { sendMonthlySummaries } from "@/lib/monthly-summary";
import { sendArticleEmails } from "@/lib/article-emails";
import { sendClassUpdates } from "@/lib/class-updates";
import { checkGoogleConnection, LESSON_TIMEZONE } from "@/lib/google";
import { createServerJobClient, recordGoogleStatus } from "@/lib/integration-status";
import { emails, sendNotification, type WeeklySummary } from "@/lib/notifications";
import { formatInTimeZone } from "date-fns-tz";

/** The day of the month the DeepL reminder goes out (the allowance resets about a week later). */
export const DEEPL_REMINDER_DAY = "20";
/** DeepL is on hold (Trevor, 2026-09-30): no reminder until he says so; set to false to send it again. */
export const DEEPL_ON_HOLD = true;

/**
 * Runs once a day (see vercel.json): checks the Google connection, sends
 * each student one reminder for lessons in the next 36 hours, and sends the
 * admin the day's agenda, on Sundays each private student their week of classes (class-updates.ts), on Mondays the weekly summary and the article emails (students who chose them), and on the 1st each active student their month. It also sends any sign-up or subscriber alert, and
 * any welcome email, the database's own call to /api/alerts/push missed. The database functions it
 * calls are guarded by the same CRON_SECRET the request was authorized with.
 */
export async function runDailyJob(secret: string) {
  await sendAlerts(secret).catch((error) => console.error("[daily-job] alerts failed:", error));
  await sendWelcomes(secret).catch((error) => console.error("[daily-job] welcome emails failed:", error));

  const google = await checkGoogleConnection();
  await recordGoogleStatus(google.ok, google.ok ? "Daily check passed." : google.message);
  // Leave reminders unclaimed while Google is down, so tomorrow's run can still send them.
  if (!google.ok) return { google: google.message, reminders: 0, agenda: false, deeplReminder: false, weekly: false, classUpdates: 0 };

  const supabase = createServerJobClient();
  const { data: adminZone } = await supabase.rpc("admin_timezone");
  const zone = adminZone || "America/Denver";

  const deeplReminder = !DEEPL_ON_HOLD && formatInTimeZone(new Date(), zone, "d") === DEEPL_REMINDER_DAY;
  if (deeplReminder) await sendNotification(emails.deeplReset());

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
    zone,
  );
  await sendNotification(agendaEmail);

  // Sundays (ISO day 7) in the admin's zone: each private student's week of classes.
  const classUpdates =
    formatInTimeZone(new Date(), zone, "i") === "7"
      ? await sendClassUpdates(secret, formatInTimeZone(new Date(), zone, "yyyy-MM-dd")).catch((error) => {
          console.error("[daily-job] class updates failed:", error);
          return 0;
        })
      : 0;

  // Mondays (ISO day 1) in the admin's zone: 7 AM Mountain in summer, 6 AM in winter.
  const weekly = formatInTimeZone(new Date(), zone, "i") === "1";
  if (weekly) {
    const { data: summary, error: summaryError } = await supabase.rpc("weekly_summary", { p_secret: secret });
    if (summaryError) throw new Error(`weekly_summary: ${summaryError.message}`);
    await sendNotification(emails.weeklySummary(summary as unknown as WeeklySummary, zone));
  }

  // Articles are released on Mondays (Denver): tell the students who chose article emails.
  const articles = weekly
    ? await sendArticleEmails(secret, formatInTimeZone(new Date(), LESSON_TIMEZONE, "yyyy-MM-dd")).catch((error) => {
        console.error("[daily-job] article emails failed:", error);
        return 0;
      })
    : 0;

  // The 1st in the admin's zone: each student who did anything last month gets their summary.
  const monthly = formatInTimeZone(new Date(), zone, "d") === "1" ? await sendMonthlySummaries(secret) : 0;

  return { google: "ok", reminders: due?.length ?? 0, agenda: agendaEmail !== null, deeplReminder, weekly, articles, monthly, classUpdates };
}
