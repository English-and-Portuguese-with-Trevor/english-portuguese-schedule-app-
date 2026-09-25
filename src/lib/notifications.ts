import { differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { renderEmail, type EmailContent } from "@/lib/email-template";
import {
  createLessonEvent,
  deleteLessonEvent,
  isGoogleConfigured,
  LESSON_TIMEZONE,
  sendEmail,
} from "@/lib/google";
import type { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://schedule.englishandportuguesewithtrevor.com";
export const LESSON_NAME = "English / Portuguese Lesson";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface Lesson {
  bookingId: string;
  start: string;
  end: string;
  studentName: string | null;
  studentEmail: string | null;
  /** The student's browser time zone when they booked; unknown for older bookings. */
  studentTimezone?: string | null;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** "3:00 PM – 4:00 PM, Thursday, September 24, 2026 (Mountain Daylight Time)" */
export function lessonWhen(lesson: Pick<Lesson, "start" | "end">, timeZone: string) {
  const start = new Date(lesson.start);
  const end = new Date(lesson.end);
  return (
    `${formatInTimeZone(start, timeZone, "h:mm a")} – ${formatInTimeZone(end, timeZone, "h:mm a")}, ` +
    `${formatInTimeZone(start, timeZone, "EEEE, MMMM d, yyyy")} (${formatInTimeZone(start, timeZone, "zzzz")})`
  );
}

function shortTime(start: string, timeZone: string) {
  return formatInTimeZone(new Date(start), timeZone, "EEE, MMM d, h:mm a");
}

function lessonType(lesson: Lesson) {
  return `${LESSON_NAME} (${differenceInMinutes(new Date(lesson.end), new Date(lesson.start))} min)`;
}

/** Students see their own time zone; Mountain Time if we don't know it. */
function studentZone(lesson: Lesson) {
  return lesson.studentTimezone || LESSON_TIMEZONE;
}

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] || "there";
}

function studentEmail(lesson: Lesson, subject: string, content: EmailContent): Email | null {
  if (!lesson.studentEmail) return null;
  return { to: lesson.studentEmail, subject: `${subject}: ${shortTime(lesson.start, studentZone(lesson))}`, ...renderEmail(content) };
}

/** The details every email shown to a student starts with. */
function studentDetails(lesson: Lesson): [string, string][] {
  return [
    ["Lesson", lessonType(lesson)],
    ["Date/time", lessonWhen(lesson, studentZone(lesson))],
  ];
}

/** Your time, plus the student's when they're somewhere else. */
function adminDetails(lesson: Lesson): [string, string][] {
  const rows: [string, string][] = [
    ["Lesson", lessonType(lesson)],
    ["Student", lesson.studentName ?? "Unknown"],
  ];
  if (lesson.studentEmail) rows.push(["Student email", lesson.studentEmail]);
  rows.push(["Your time", lessonWhen(lesson, LESSON_TIMEZONE)]);
  if (lesson.studentTimezone && lesson.studentTimezone !== LESSON_TIMEZONE) {
    rows.push(["Student's time", lessonWhen(lesson, lesson.studentTimezone)]);
  }
  return rows;
}

/** Where emails about students go; unset means none are sent. */
export function adminEmail() {
  return process.env.ADMIN_NOTIFY_EMAIL || null;
}

function toAdmin(lesson: Lesson, subject: string, content: EmailContent): Email | null {
  const to = adminEmail();
  if (!to) return null;
  const who = lesson.studentName ?? "A student";
  return { to, subject: `${subject}: ${who}, ${shortTime(lesson.start, LESSON_TIMEZONE)}`, ...renderEmail(content) };
}

const meet = (meetLink: string | null) =>
  meetLink ? { label: "Google Meet: join the lesson", url: meetLink } : undefined;

// Each builder returns null when there's nobody to send it to.
export const emails = {
  requestReceived(lesson: Lesson): Email | null {
    return studentEmail(lesson, "Lesson request received", {
      heading: "Lesson request received",
      intro:
        `Hi ${firstName(lesson.studentName)}, thanks for your request! It's less than 72 hours away, so Trevor ` +
        `needs to approve it first. Once he does, you'll get a calendar invitation with the Google Meet link.`,
      details: [...studentDetails(lesson), ["Status", "Waiting for approval"]],
      button: { label: "View your lessons", url: SITE_URL },
    });
  },

  confirmed(lesson: Lesson, meetLink: string | null): Email | null {
    return studentEmail(lesson, "Lesson confirmed", {
      heading: "Your lesson is confirmed",
      intro: `Hi ${firstName(lesson.studentName)}, you're all set! A calendar invitation is on its way too.`,
      details: studentDetails(lesson),
      location: meet(meetLink),
      button: { label: "View or cancel your lesson", url: SITE_URL },
      footerNote: "Cancelling less than 24 hours before the lesson still counts as a class.",
    });
  },

  declined(lesson: Lesson): Email | null {
    return studentEmail(lesson, "Lesson request not available", {
      heading: "This time isn't available",
      intro: `Hi ${firstName(lesson.studentName)}, sorry, Trevor can't make the lesson you requested. Please pick another time.`,
      details: studentDetails(lesson),
      button: { label: "Pick another time", url: SITE_URL },
    });
  },

  cancelledByTeacher(lesson: Lesson): Email | null {
    return studentEmail(lesson, "Lesson cancelled", {
      heading: "Your lesson was cancelled",
      intro: `Hi ${firstName(lesson.studentName)}, Trevor had to cancel this lesson. Sorry about that! You can book another time.`,
      details: studentDetails(lesson),
      button: { label: "Book another time", url: SITE_URL },
    });
  },

  adminNewBooking(lesson: Lesson, meetLink: string | null): Email | null {
    return toAdmin(lesson, "New lesson", {
      heading: "A new lesson has been booked",
      intro: "It's confirmed and on the calendar.",
      details: adminDetails(lesson),
      location: meet(meetLink),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },

  adminApprovalNeeded(lesson: Lesson): Email | null {
    return toAdmin(lesson, "Approval needed", {
      heading: "A lesson request needs your approval",
      intro: "It's less than 72 hours away, so it's waiting for you to approve or decline it.",
      details: adminDetails(lesson),
      button: { label: "Approve or decline", url: `${SITE_URL}/admin/bookings` },
    });
  },

  adminStudentCancelled(lesson: Lesson, how: { wasPending: boolean; late: boolean }): Email | null {
    if (how.wasPending) {
      return toAdmin(lesson, "Request withdrawn", {
        heading: "A lesson request was withdrawn",
        details: adminDetails(lesson),
      });
    }
    return toAdmin(lesson, how.late ? "Late cancellation" : "Lesson cancelled", {
      heading: how.late ? "Late cancellation: this lesson still counts" : "A lesson was cancelled",
      intro: how.late ? "The student cancelled less than 24 hours before the start, so it still counts as a class." : undefined,
      details: adminDetails(lesson),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },
};

async function attempt(label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    // A Google hiccup must never undo or block a booking; log and move on.
    console.error(`[notifications] ${label} failed:`, error);
  }
}

async function send(email: Email | null) {
  if (email) await attempt(`email "${email.subject}"`, () => sendEmail(email));
}

function configured() {
  if (isGoogleConfigured()) return true;
  console.warn("[notifications] Google isn't configured (GOOGLE_* env vars); skipping.");
  return false;
}

/** Creates the Calendar event with a Meet link and records it on the booking. */
async function scheduleMeeting(supabase: Supabase, lesson: Lesson): Promise<string | null> {
  let meetLink: string | null = null;
  await attempt("create calendar event", async () => {
    const event = await createLessonEvent({ ...lesson, studentName: lesson.studentName ?? "Student" });
    meetLink = event.meetLink;
    const { error } = await supabase.rpc("set_booking_meeting", {
      p_booking_id: lesson.bookingId,
      p_event_id: event.eventId,
      p_meet_link: event.meetLink ?? "",
    });
    if (error) throw error;
  });
  return meetLink;
}

/** A student booked: confirmed right away (72h+ out) or pending approval. */
export async function afterStudentBooking(supabase: Supabase, lesson: Lesson, pending: boolean) {
  if (!configured()) return;
  if (pending) {
    await Promise.all([send(emails.requestReceived(lesson)), send(emails.adminApprovalNeeded(lesson))]);
  } else {
    const meetLink = await scheduleMeeting(supabase, lesson);
    await Promise.all([send(emails.confirmed(lesson, meetLink)), send(emails.adminNewBooking(lesson, meetLink))]);
  }
}

/** The admin approved a pending request. */
export async function afterApproval(supabase: Supabase, lesson: Lesson) {
  if (!configured()) return;
  const meetLink = await scheduleMeeting(supabase, lesson);
  await send(emails.confirmed(lesson, meetLink));
}

/** The admin booked a student in directly; the calendar invite is the notice. */
export async function afterAdminBooking(supabase: Supabase, lesson: Lesson) {
  if (!configured()) return;
  await scheduleMeeting(supabase, lesson);
}

export async function afterCancellation(
  lesson: Lesson,
  how: { by: "student" | "admin"; wasPending: boolean; late: boolean; eventId: string | null },
) {
  if (!configured()) return;
  if (how.eventId) {
    const eventId = how.eventId;
    await attempt("delete calendar event", () => deleteLessonEvent(eventId));
  }
  if (how.by === "student") {
    await send(emails.adminStudentCancelled(lesson, how));
  } else {
    await send(how.wasPending ? emails.declined(lesson) : emails.cancelledByTeacher(lesson));
  }
}
