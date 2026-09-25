import { formatInTimeZone } from "date-fns-tz";

import {
  createLessonEvent,
  deleteLessonEvent,
  isGoogleConfigured,
  LESSON_TIMEZONE,
  sendEmail,
} from "@/lib/google";
import type { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://schedule.englishandportuguesewithtrevor.com";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface Lesson {
  bookingId: string;
  start: string;
  end: string;
  studentName: string | null;
  studentEmail: string | null;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export function lessonTime(start: string) {
  return `${formatInTimeZone(new Date(start), LESSON_TIMEZONE, "EEEE, MMMM d 'at' h:mm a")} (Mountain Time)`;
}

function shortTime(start: string) {
  return formatInTimeZone(new Date(start), LESSON_TIMEZONE, "EEE, MMM d, h:mm a");
}

function greeting(name: string | null) {
  return `Hi ${name?.trim().split(/\s+/)[0] || "there"},`;
}

const SIGN_OFF = "\n\nTrevor\nEnglish & Portuguese with Trevor";

/** Where emails about students go; unset means none are sent. */
export function adminEmail() {
  return process.env.ADMIN_NOTIFY_EMAIL || null;
}

// Each builder returns null when there's nobody to send it to.
export const emails = {
  requestReceived(lesson: Lesson): Email | null {
    if (!lesson.studentEmail) return null;
    return {
      to: lesson.studentEmail,
      subject: `Lesson request received: ${shortTime(lesson.start)}`,
      text:
        `${greeting(lesson.studentName)}\n\n` +
        `I got your request for a lesson on ${lessonTime(lesson.start)}. ` +
        `Because it's less than 72 hours away, I need to approve it first. ` +
        `Once I do, you'll get a calendar invitation with the Google Meet link.\n\n` +
        `You can see or cancel your lessons at ${SITE_URL}` +
        SIGN_OFF,
    };
  },

  approved(lesson: Lesson, meetLink: string | null): Email | null {
    if (!lesson.studentEmail) return null;
    return {
      to: lesson.studentEmail,
      subject: `Lesson confirmed: ${shortTime(lesson.start)}`,
      text:
        `${greeting(lesson.studentName)}\n\n` +
        `Your lesson on ${lessonTime(lesson.start)} is confirmed.` +
        (meetLink ? `\n\nJoin on Google Meet: ${meetLink}` : "") +
        `\n\nA calendar invitation is on its way too.` +
        SIGN_OFF,
    };
  },

  declined(lesson: Lesson): Email | null {
    if (!lesson.studentEmail) return null;
    return {
      to: lesson.studentEmail,
      subject: `Lesson request not available: ${shortTime(lesson.start)}`,
      text:
        `${greeting(lesson.studentName)}\n\n` +
        `Sorry, I can't make the lesson you requested on ${lessonTime(lesson.start)}. ` +
        `Please pick another time at ${SITE_URL}` +
        SIGN_OFF,
    };
  },

  cancelledByTeacher(lesson: Lesson): Email | null {
    if (!lesson.studentEmail) return null;
    return {
      to: lesson.studentEmail,
      subject: `Lesson cancelled: ${shortTime(lesson.start)}`,
      text:
        `${greeting(lesson.studentName)}\n\n` +
        `I had to cancel our lesson on ${lessonTime(lesson.start)}. Sorry about that! ` +
        `You can book another time at ${SITE_URL}` +
        SIGN_OFF,
    };
  },

  adminNewBooking(lesson: Lesson): Email | null {
    const to = adminEmail();
    if (!to) return null;
    return {
      to,
      subject: `New lesson: ${lesson.studentName ?? "A student"}, ${shortTime(lesson.start)}`,
      text:
        `${lesson.studentName ?? "A student"} booked a lesson on ${lessonTime(lesson.start)}. ` +
        `It's confirmed and on your calendar.\n\n${SITE_URL}/admin/bookings`,
    };
  },

  adminApprovalNeeded(lesson: Lesson): Email | null {
    const to = adminEmail();
    if (!to) return null;
    return {
      to,
      subject: `Approval needed: ${lesson.studentName ?? "A student"}, ${shortTime(lesson.start)}`,
      text:
        `${lesson.studentName ?? "A student"} requested a lesson on ${lessonTime(lesson.start)}. ` +
        `It's less than 72 hours away, so it's waiting for your approval.\n\n` +
        `Approve or decline: ${SITE_URL}/admin/bookings`,
    };
  },

  adminStudentCancelled(lesson: Lesson, how: { wasPending: boolean; late: boolean }): Email | null {
    const to = adminEmail();
    if (!to) return null;
    const who = lesson.studentName ?? "A student";
    if (how.wasPending) {
      return {
        to,
        subject: `Request withdrawn: ${who}, ${shortTime(lesson.start)}`,
        text: `${who} withdrew their request for ${lessonTime(lesson.start)}.`,
      };
    }
    return {
      to,
      subject: `${how.late ? "Late cancellation" : "Lesson cancelled"}: ${who}, ${shortTime(lesson.start)}`,
      text:
        `${who} cancelled their lesson on ${lessonTime(lesson.start)}.` +
        (how.late ? " It was less than 24 hours before the start, so it still counts as a class." : "") +
        `\n\n${SITE_URL}/admin/bookings`,
    };
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
    await scheduleMeeting(supabase, lesson);
    await send(emails.adminNewBooking(lesson));
  }
}

/** The admin approved a pending request. */
export async function afterApproval(supabase: Supabase, lesson: Lesson) {
  if (!configured()) return;
  const meetLink = await scheduleMeeting(supabase, lesson);
  await send(emails.approved(lesson, meetLink));
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
