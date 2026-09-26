import { differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { renderEmail, type EmailContent } from "@/lib/email-template";
import {
  createLessonEvent,
  deleteLessonEvent,
  isGoogleConfigured,
  moveLessonEvent,
  LESSON_TIMEZONE,
  sendEmail,
} from "@/lib/google";
import { recordGoogleStatus } from "@/lib/integration-status";
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
  /** Booking question answers; absent on bookings made before the questions existed. */
  language?: string | null;
  whatsapp?: string | null;
  /** The admin's own time zone (synced from their browser); Mountain Time if unknown. */
  adminTimezone?: string | null;
  /** For a reschedule request: the lesson's current (original) time. */
  rescheduledFrom?: { start: string; end: string } | null;
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
  const adminZone = lesson.adminTimezone || LESSON_TIMEZONE;
  rows.push(["Your time", lessonWhen(lesson, adminZone)]);
  if (lesson.studentTimezone && lesson.studentTimezone !== adminZone) {
    rows.push(["Student's time", lessonWhen(lesson, lesson.studentTimezone)]);
  }
  return rows;
}

/** Where emails about students go; unset means none are sent. */
export function adminEmail() {
  return process.env.ADMIN_NOTIFY_EMAIL || null;
}

const LANGUAGE_LABELS: Record<string, string> = { ENGLISH: "English", PORTUGUESE: "Portuguese" };

/** The student's booking answers, shown in the admin's emails. */
function questions(lesson: Lesson): [string, string][] {
  const answers: [string, string][] = [];
  if (lesson.language) {
    answers.push([
      "Are you looking for English or Portuguese lessons?",
      LANGUAGE_LABELS[lesson.language] ?? lesson.language,
    ]);
  }
  if (lesson.whatsapp) answers.push(["WhatsApp number", lesson.whatsapp]);
  return answers;
}

function toAdmin(lesson: Lesson, subject: string, content: EmailContent): Email | null {
  const to = adminEmail();
  if (!to) return null;
  const who = lesson.studentName ?? "A student";
  return {
    to,
    subject: `${subject}: ${who}, ${shortTime(lesson.start, lesson.adminTimezone || LESSON_TIMEZONE)}`,
    ...renderEmail({ ...content, questions: questions(lesson) }),
  };
}

const meet = (meetLink: string | null) =>
  meetLink ? { label: "Google Meet: join the lesson", url: meetLink } : undefined;

/** One row of the admin's morning agenda (from the admin_agenda database function). */
export interface AgendaItem {
  status: string;
  start: string;
  end: string;
  studentName: string | null;
  studentTimezone: string | null;
  language: string | null;
  whatsapp: string | null;
  rescheduleFrom: string | null;
}

function agendaRow(item: AgendaItem, adminZone: string): [string, string] {
  const parts = [item.studentName ?? "Unknown student"];
  if (item.language) parts.push(LANGUAGE_LABELS[item.language] ?? item.language);
  if (item.whatsapp) parts.push(`WhatsApp ${item.whatsapp}`);
  if (item.studentTimezone && item.studentTimezone !== adminZone) {
    parts.push(`their time ${formatInTimeZone(new Date(item.start), item.studentTimezone, "h:mm a zzz")}`);
  }
  if (item.rescheduleFrom) parts.push(`reschedule from ${shortTime(item.rescheduleFrom, adminZone)}`);
  return [shortTime(item.start, adminZone), parts.join(" · ")];
}

// Each builder returns null when there's nobody to send it to.
export const emails = {
  rescheduleRequested(lesson: Lesson): Email | null {
    const from = lesson.rescheduledFrom;
    return studentEmail(lesson, "Reschedule request received", {
      heading: "Reschedule request received",
      intro:
        `Hi ${firstName(lesson.studentName)}, thanks! Your current lesson stays booked until Trevor ` +
        `approves the new time. You'll get an email either way.`,
      details: [
        ["Lesson", lessonType(lesson)],
        ["New time", lessonWhen(lesson, studentZone(lesson))],
        ...(from ? ([["Current time", lessonWhen(from, studentZone(lesson))]] as [string, string][]) : []),
        ["Status", "Waiting for approval"],
      ],
      button: { label: "View your lessons", url: SITE_URL },
    });
  },

  rescheduled(lesson: Lesson, meetLink: string | null): Email | null {
    const from = lesson.rescheduledFrom;
    return studentEmail(lesson, "Lesson moved", {
      heading: "Your lesson has been moved",
      intro: `Hi ${firstName(lesson.studentName)}, the new time is confirmed. Your calendar invitation has been updated.`,
      details: [
        ...studentDetails(lesson),
        ...(from ? ([["Previously", lessonWhen(from, studentZone(lesson))]] as [string, string][]) : []),
      ],
      location: meet(meetLink),
      button: { label: "View or cancel your lesson", url: SITE_URL },
      footerNote: "Cancelling less than 24 hours before the lesson still counts as a class.",
    });
  },

  rescheduleDeclined(lesson: Lesson): Email | null {
    const from = lesson.rescheduledFrom;
    return studentEmail(lesson, "Reschedule not available", {
      heading: "The new time isn't available",
      intro: `Hi ${firstName(lesson.studentName)}, sorry, Trevor can't move your lesson to that time. Your lesson stays as it was.`,
      details: [
        ["Lesson", lessonType(lesson)],
        ...(from ? ([["Your lesson", lessonWhen(from, studentZone(lesson))]] as [string, string][]) : []),
        ["Requested time", lessonWhen(lesson, studentZone(lesson))],
      ],
      button: { label: "View your lessons", url: SITE_URL },
    });
  },

  adminRescheduleRequested(lesson: Lesson): Email | null {
    const from = lesson.rescheduledFrom;
    const adminZone = lesson.adminTimezone || LESSON_TIMEZONE;
    return toAdmin(lesson, "Reschedule requested", {
      heading: "A student wants to reschedule",
      intro: "Their current lesson stays booked until you approve or decline the new time.",
      details: [
        ...adminDetails(lesson),
        ...(from ? ([["Current time", lessonWhen(from, adminZone)]] as [string, string][]) : []),
      ],
      button: { label: "Approve or decline", url: `${SITE_URL}/admin/bookings` },
    });
  },

  adminRescheduleWithdrawn(lesson: Lesson): Email | null {
    return toAdmin(lesson, "Reschedule withdrawn", {
      heading: "A reschedule request was withdrawn",
      intro: "The student's original lesson stays as it was.",
      details: adminDetails(lesson),
    });
  },

  reminder(lesson: Lesson, meetLink: string | null): Email | null {
    return studentEmail(lesson, "Lesson reminder", {
      heading: "Your lesson is coming up",
      intro: `Hi ${firstName(lesson.studentName)}, just a reminder about your lesson. See you soon!`,
      details: studentDetails(lesson),
      location: meet(meetLink),
      button: { label: "View or cancel your lesson", url: SITE_URL },
      footerNote: "Cancelling less than 24 hours before the lesson still counts as a class.",
    });
  },

  adminAgenda(items: AgendaItem[], adminZone: string): Email | null {
    const to = adminEmail();
    const lessons = items.filter((i) => i.status === "CONFIRMED");
    const waiting = items.filter((i) => i.status === "PENDING");
    if (!to || items.length === 0) return null;
    const summary = [
      `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} in the next 24 hours`,
      ...(waiting.length ? [`${waiting.length} request${waiting.length === 1 ? "" : "s"} waiting`] : []),
    ].join(", ");
    return {
      to,
      subject: `Your day: ${summary}`,
      ...renderEmail({
        heading: "Your day ahead",
        intro: `${summary}. Times are in ${formatInTimeZone(new Date(), adminZone, "zzzz")}.`,
        details: [],
        sections: [
          { title: "Lessons", rows: lessons.map((i) => agendaRow(i, adminZone)) },
          { title: "Waiting for your approval", rows: waiting.map((i) => agendaRow(i, adminZone)) },
        ],
        button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
      }),
    };
  },

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
    // A Google hiccup must never undo or block a booking; log it, flag it
    // on the admin Overview, and move on.
    console.error(`[notifications] ${label} failed:`, error);
    const detail = error instanceof Error ? error.message : String(error);
    await recordGoogleStatus(false, `${label} failed: ${detail}`);
  }
}

async function send(email: Email | null) {
  if (email) await attempt(`email "${email.subject}"`, () => sendEmail(email));
}

/** Sends one notification; failures are logged and flagged, never thrown. */
export const sendNotification = send;

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

/** A student asked to move a confirmed lesson; it waits for approval. */
export async function afterRescheduleRequest(lesson: Lesson) {
  if (!configured()) return;
  await Promise.all([send(emails.rescheduleRequested(lesson)), send(emails.adminRescheduleRequested(lesson))]);
}

/**
 * The admin approved a reschedule: move the original calendar event (same
 * Meet link) to the new time and record it on the new booking.
 */
export async function afterRescheduleApproval(
  supabase: Supabase,
  lesson: Lesson,
  original: { eventId: string | null; meetLink: string | null },
) {
  if (!configured()) return;
  let meetLink = original.meetLink;
  if (original.eventId) {
    const eventId = original.eventId;
    await attempt("move calendar event", async () => {
      meetLink = (await moveLessonEvent(eventId, lesson.start, lesson.end)).meetLink ?? meetLink;
      const { error } = await supabase
        .from("bookings")
        .update({ google_event_id: eventId, meet_link: meetLink })
        .eq("id", lesson.bookingId);
      if (error) throw error;
    });
  } else {
    meetLink = await scheduleMeeting(supabase, lesson);
  }
  await send(emails.rescheduled(lesson, meetLink));
}

export async function afterCancellation(
  lesson: Lesson,
  how: { by: "student" | "admin"; wasPending: boolean; late: boolean; eventId: string | null },
) {
  if (!configured()) return;
  if (lesson.rescheduledFrom) {
    // A reschedule request, not a lesson: the original stays untouched.
    await send(how.by === "student" ? emails.adminRescheduleWithdrawn(lesson) : emails.rescheduleDeclined(lesson));
    return;
  }
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
