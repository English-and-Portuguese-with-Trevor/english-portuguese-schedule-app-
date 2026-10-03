import { differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { alertTitle, flagDetails, type AlertRow } from "@/lib/alerts";
import { buildDisplayNames } from "@/lib/display-names";
import { renderEmail, type EmailContent } from "@/lib/email-template";
import {
  createLessonEvent,
  deleteLessonEvent,
  isGoogleConfigured,
  moveLessonEvent,
  LESSON_TIMEZONE,
  sendEmail,
} from "@/lib/google";
import { createServerJobClient, recordGoogleStatus } from "@/lib/integration-status";
import { siteLanguage, type SiteLanguage } from "@/lib/prefs";
import { LOCALES } from "@/i18n/format";
import { translator, type Translate } from "@/i18n/translate";
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
/** What weekly_summary returns: the last 7 days, the classes in the next 7, and who has gone quiet. */
export interface WeeklySummary {
  people: { id: string; full_name: string | null; email: string | null; created_at: string }[];
  new_signups: string[];
  new_subscribers: string[];
  active_students: number;
  lessons_finished: number;
  puzzles_played: number;
  activities_finished: number;
  cards_studied: number;
  classes_held: number;
  classes_canceled: number;
  late_cancellations: number;
  upcoming: { start: string; student_id: string; language: string | null }[];
  /** last_active null: never did anything. */
  inactive: { id: string; last_active: string | null }[];
}

/** One student's last month, from claim_monthly_summaries. */
export interface MonthlySummary {
  id: string;
  full_name: string | null;
  email: string | null;
  timezone: string | null;
  /** 'en' | 'es' | 'pt' | 'fr'; null reads as English. */
  site_language: string | null;
  learning: string;
  /** The first day of the month, 'YYYY-MM-DD'. */
  month: string;
  classes_taken: number;
  class_package: number | null;
  completed: number | null;
  next_class: string | null;
  lessons_done: string[];
  lessons_month: string[];
  puzzle_days: string[];
  activities_finished: number;
  cards_studied: number;
}

/** A student who chose article emails, from claim_article_emails. */
export interface ArticleReader {
  id: string;
  full_name: string | null;
  email: string | null;
  site_language: string | null;
  learning: string;
}

/** The lessons site's lessons.json: every lesson in order, English ones and articles marked. */
export type LessonCatalog = { id: string; title: string; learning?: string; article?: boolean; releaseOn?: string }[];

/** One private student's week, from claim_class_updates: their classes in the coming week and where their package stands. */
export type ClassUpdate = {
  id: string;
  full_name: string | null;
  email: string | null;
  timezone: string | null;
  site_language: string | null;
  learning: string;
  /** The Sunday the week starts (Denver date). */
  week: string;
  class_package: number | null;
  completed: number | null;
  classes: { start: string; end: string; meet_link: string | null }[];
};

/** The language a student email is written in: their site language, English when unknown. */
function emailLanguage(code: string | null) {
  return siteLanguage({}, code ? [code] : []);
}

/** "Hi Ana!" in the email's language, or "Hi there!" without a name. */
function greeting(fullName: string | null, t: Translate) {
  const name = fullName?.trim().split(/\s+/)[0];
  return name ? t("Hi {name}!", { name }) : t("Hi there!");
}

/** "Wednesday, October 7, 6:00 PM" in English; the language's own wording otherwise. */
function studentDateTime(iso: string, timeZone: string, lang: SiteLanguage) {
  if (lang === "en") return formatInTimeZone(new Date(iso), timeZone, "EEEE, MMMM d, h:mm a");
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** The longest run of days in a row in a list of 'YYYY-MM-DD' days. */
export function longestStreak(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((day, i) => {
    const gap = i ? (Date.parse(day) - Date.parse(sorted[i - 1])) / 86_400_000 : 0;
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

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
      footerNote: "Canceling less than 24 hours before the lesson still counts as a class.",
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
      footerNote: "Canceling less than 24 hours before the lesson still counts as a class.",
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

  /** Monday mornings (daily job): the week in numbers, the classes ahead, and students gone quiet. */
  weeklySummary(summary: WeeklySummary, adminZone: string): Email | null {
    const to = adminEmail();
    if (!to) return null;
    const names = buildDisplayNames(summary.people);
    const name = (id: string) => names[id] ?? "Unknown";
    const day = (iso: string) => formatInTimeZone(new Date(iso), adminZone, "MMM d");
    const joined = new Map(summary.people.map((p) => [p.id, p.created_at]));
    const count = (n: number) => String(n);
    const canceled =
      summary.classes_canceled + (summary.late_cancellations ? ` (${summary.late_cancellations} late)` : "");
    const ahead = summary.upcoming.length;
    return {
      to,
      subject: `Your week: ${summary.active_students} active, ${summary.new_signups.length} new, ${ahead} class${ahead === 1 ? "" : "es"} ahead`,
      ...renderEmail({
        heading: "Your week",
        intro: `The last 7 days, up to ${formatInTimeZone(new Date(), adminZone, "EEEE, MMMM d")}. Times are in ${formatInTimeZone(new Date(), adminZone, "zzzz")}.`,
        details: [
          ["New sign-ups", count(summary.new_signups.length)],
          ["New subscribers", count(summary.new_subscribers.length)],
          ["Active students", count(summary.active_students)],
          ["Lessons finished", count(summary.lessons_finished)],
          ["Puzzles played", count(summary.puzzles_played)],
          ["Activities finished", count(summary.activities_finished)],
          ["Flashcards studied", count(summary.cards_studied)],
          ["Classes held", count(summary.classes_held)],
          ["Classes canceled", canceled],
        ],
        sections: [
          {
            title: "New sign-ups",
            rows: summary.new_signups.map((id) => [name(id), `joined ${day(joined.get(id)!)}`]),
          },
          { title: "New subscribers", rows: summary.new_subscribers.map((id) => [name(id), "subscribed"]) },
          {
            title: "Classes this week",
            rows: summary.upcoming.map((c) => [
              shortTime(c.start, adminZone),
              [name(c.student_id), c.language ? (LANGUAGE_LABELS[c.language] ?? c.language) : null].filter(Boolean).join(" · "),
            ]),
          },
          {
            title: "Quiet for 14 days or more",
            rows: summary.inactive.map((s) => [name(s.id), s.last_active ? `last active ${day(s.last_active)}` : "never active"]),
          },
        ],
        button: { label: "Open the admin dashboard", url: "https://englishandportuguesewithtrevor.com/admin/" },
      }),
    };
  },

  /** Sent on the 20th of each month: use what's left of the DeepL allowance before it resets. */
  deeplReset(): Email | null {
    const to = adminEmail();
    if (!to) return null;
    return {
      to,
      subject: "DeepL credits reset in about a week",
      ...renderEmail({
        heading: "DeepL credits reset in about a week",
        intro:
          "Your DeepL character allowance for this period ends in about a week, and what's left doesn't carry over. " +
          "If there's lesson text waiting to be translated, this is the week to run the lessons deploy with a higher character limit.",
        details: [],
        button: { label: "See DeepL usage", url: "https://englishandportuguesewithtrevor.com/admin/#/translations" },
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
      footerNote: "Canceling less than 24 hours before the lesson still counts as a class.",
    });
  },

  /** Several lessons Trevor booked at once (a weekly class): one email listing them all. */
  seriesBooked(lessons: Lesson[], meetLinks: (string | null)[]): Email | null {
    const [first] = lessons;
    if (!first) return null;
    const zone = studentZone(first);
    const email = studentEmail(first, `${lessons.length} lessons booked, starting`, {
      heading: `Your ${lessons.length} lessons are booked`,
      intro:
        `Hi ${firstName(first.studentName)}, Trevor booked your lessons! Each one has its own calendar invitation and ` +
        `Google Meet link, on their way separately. Times are in ${formatInTimeZone(new Date(first.start), zone, "zzzz")}.`,
      details: [["Lesson", lessonType(first)]],
      sections: [
        {
          title: "Your lessons",
          rows: lessons.map((l, i) => [shortTime(l.start, zone), meetLinks[i] ?? ""] as [string, string]),
        },
      ],
      button: { label: "View or cancel your lessons", url: SITE_URL },
      footerNote: "Canceling less than 24 hours before a lesson still counts as a class.",
    });
    return email;
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
    return studentEmail(lesson, "Lesson canceled", {
      heading: "Your lesson was canceled",
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
    return toAdmin(lesson, how.late ? "Late cancellation" : "Lesson canceled", {
      heading: how.late ? "Late cancellation: this lesson still counts" : "A lesson was canceled",
      intro: how.late ? "The student canceled less than 24 hours before the start, so it still counts as a class." : undefined,
      details: adminDetails(lesson),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },
  // Copies of the changes the admin makes, so every scheduling change reaches
  // their inbox, not only the ones students make.

  adminConfirmed(lesson: Lesson, meetLink: string | null): Email | null {
    return toAdmin(lesson, "You approved", {
      heading: "You approved a lesson request",
      intro: "The student has been emailed, and the lesson is on the calendar.",
      details: adminDetails(lesson),
      location: meet(meetLink),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },

  adminBooked(lesson: Lesson, meetLink: string | null): Email | null {
    return toAdmin(lesson, "You booked", {
      heading: "You booked a lesson for a student",
      intro: "Google sends the student the calendar invitation with the Meet link.",
      details: adminDetails(lesson),
      location: meet(meetLink),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },

  /** One email for a run of classes booked at once (a weekly class), instead of one per class. */
  adminBookedSeries(lessons: Lesson[], skipped: { start: string; reason: string }[]): Email | null {
    const [first] = lessons;
    if (!first) return null;
    const zone = first.adminTimezone || LESSON_TIMEZONE;
    return toAdmin(first, `You booked ${lessons.length} classes`, {
      heading: `You booked ${lessons.length} classes for a student`,
      intro:
        "Each class has its own calendar event and Meet link, so the student can cancel or move one week without touching the rest. " +
        "The student gets one email listing them all, and Google sends an invitation for each.",
      details: adminDetails(first).filter(([label]) => label !== "Your time" && label !== "Student's time"),
      sections: [
        { title: "Booked", rows: lessons.map((l) => [shortTime(l.start, zone), ""] as [string, string]) },
        ...(skipped.length
          ? [{ title: "Not booked", rows: skipped.map((s) => [shortTime(s.start, zone), s.reason] as [string, string]) }]
          : []),
      ],
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },

  adminRescheduled(lesson: Lesson, meetLink: string | null): Email | null {
    const from = lesson.rescheduledFrom;
    const adminZone = lesson.adminTimezone || LESSON_TIMEZONE;
    return toAdmin(lesson, "You moved", {
      heading: "You approved a reschedule",
      intro: "The lesson and its calendar event moved to the new time, and the student has been emailed.",
      details: [
        ...adminDetails(lesson),
        ...(from ? ([["Previously", lessonWhen(from, adminZone)]] as [string, string][]) : []),
      ],
      location: meet(meetLink),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },

  adminTeacherCancelled(lesson: Lesson, how: { wasPending: boolean }): Email | null {
    const from = lesson.rescheduledFrom;
    if (from) {
      const adminZone = lesson.adminTimezone || LESSON_TIMEZONE;
      return toAdmin(lesson, "You declined a reschedule", {
        heading: "You declined a reschedule request",
        intro: "The student's original lesson stays as it was, and they have been emailed.",
        details: [...adminDetails(lesson), ["Their lesson", lessonWhen(from, adminZone)]],
      });
    }
    if (how.wasPending) {
      return toAdmin(lesson, "You declined", {
        heading: "You declined a lesson request",
        intro: "The student has been emailed to pick another time.",
        details: adminDetails(lesson),
      });
    }
    return toAdmin(lesson, "You canceled", {
      heading: "You canceled a lesson",
      intro: "The calendar event was removed and the student has been emailed.",
      details: adminDetails(lesson),
      button: { label: "Open bookings", url: `${SITE_URL}/admin/bookings` },
    });
  },

  /** Classes flagged and issues reported since the last one, sent each morning (see /api/cron/flags). */
  flagDigest(flags: AlertRow[]): Email | null {
    const to = adminEmail();
    if (!to || flags.length === 0) return null;
    const title = flags.length === 1 ? "1 new flag" : `${flags.length} new flags`;
    const row = (f: AlertRow): [string, string] => [f.name || f.email || "No name", [flagDetails(f), f.email].filter(Boolean).join(" · ")];
    return {
      to,
      subject: title,
      ...renderEmail({
        heading: title,
        details: [],
        sections: [
          { title: "Flagged classes", rows: flags.filter((f) => f.kind === "flag").map(row) },
          { title: "Reported issues", rows: flags.filter((f) => f.kind === "report").map(row) },
        ],
        button: { label: "Open alerts", url: `${SITE_URL}/admin/alerts` },
      }),
    };
  },

  /** Sent once to every new account (claim_welcome_emails): what's free, the placement test, the app, and booking a class. */
  welcome(person: { full_name: string | null; email: string | null }): Email | null {
    if (!person.email) return null;
    const site = "https://englishandportuguesewithtrevor.com";
    return {
      to: person.email,
      subject: "Welcome to English & Portuguese with Trevor",
      ...renderEmail({
        heading: `Welcome, ${firstName(person.full_name)}!`,
        intro:
          "I'm really glad you're here. Your account works on every part of the site, " +
          "so here's what you can start with today, how to keep it on your phone, and how to book a class with me.",
        details: [],
        sections: [
          {
            title: "Free for you",
            rows: [
              ["Lessons", "The first five lessons in Portuguese and in English", `${site}/lessons/`],
              ["Daily puzzles", "Three free games every day", `${site}/dailies/`],
              ["Activities", "The first activities of every skill, and the games", `${site}/activities/`],
              ["Flashcards", "Study the decks and make your own", `${site}/flashcards/`],
            ],
          },
          {
            title: "Not sure where to start?",
            rows: [["Placement test", "About 10 minutes, then the lesson to start with", `${site}/placement/`]],
          },
          {
            title: "Get the app",
            rows: [["On your phone", "Put the site on your home screen, like an app", `${site}/?install=1`]],
          },
        ],
        button: { label: "Book a class", url: `${SITE_URL}/dashboard` },
        footerNote: "Any questions, just reply to this email. See you soon! Trevor",
      }),
    };
  },

  /**
   * On the 1st, to every student who did anything last month and keeps the
   * summary on: their classes and their practice in the language they're
   * learning, written in their site language. A line shows only when it has
   * something in it.
   */
  monthlySummary(person: MonthlySummary, catalog: LessonCatalog): Email | null {
    if (!person.email) return null;
    const lang = emailLanguage(person.site_language);
    const t = translator(lang);
    const site = "https://englishandportuguesewithtrevor.com";
    const monthName = new Intl.DateTimeFormat(LOCALES[lang], { month: "long", timeZone: "UTC" }).format(
      new Date(`${person.month}T12:00:00Z`),
    );
    const zone = person.timezone || LESSON_TIMEZONE;
    const lessons = catalog.filter((l) => (person.learning === "English" ? l.learning === "English" : !l.learning));
    const title = (id: string) => lessons.find((l) => l.id === id)?.title;
    const finished = person.lessons_month.filter(title);
    const done = new Set(person.lessons_done);
    const next = lessons[lessons.findLastIndex((l) => done.has(l.id)) + 1];
    const left = person.class_package ? person.class_package - ((person.completed ?? 0) % person.class_package) : null;
    const days = (n: number) => (n === 1 ? t("1 day") : t("{n} days", { n }));

    const classes: [string, string][] = [];
    if (person.classes_taken) classes.push([t("Classes taken this month"), String(person.classes_taken)]);
    if (left !== null) classes.push([t("Left in your package"), t("{left} of {total}", { left, total: person.class_package! })]);
    if (person.next_class) classes.push([t("Next class"), studentDateTime(person.next_class, zone, lang)]);

    const practice: [string, string][] = [];
    if (finished.length) {
      practice.push([t("Lessons finished"), t("{count} (latest: {title})", { count: finished.length, title: title(finished.at(-1)!)! })]);
    }
    if (person.puzzle_days.length) {
      const streak = days(longestStreak(person.puzzle_days));
      practice.push([t("Daily puzzles"), t("{days} · best streak: {streak}", { days: days(person.puzzle_days.length), streak })]);
    }
    if (person.activities_finished) practice.push([t("Activities finished"), String(person.activities_finished)]);
    if (person.cards_studied) practice.push([t("Flashcards studied"), String(person.cards_studied)]);

    const sections = [];
    if (classes.length) sections.push({ title: t("Your classes with me"), rows: classes });
    if (practice.length) sections.push({ title: t("Your practice"), rows: practice });
    if (next) sections.push({ title: t("Up next"), rows: [[t("Lesson"), next.title, `${site}/lessons/#/${next.id}`]] as [string, string, string][] });
    return {
      to: person.email,
      subject: t("Your month at English & Portuguese with Trevor"),
      ...renderEmail({
        heading: greeting(person.full_name, t),
        intro: t("Here's what you did in {month}. Nice work!", { month: monthName }),
        details: [],
        sections,
        button: { label: t("See all your progress"), url: `${site}/progress/` },
        footerNote: `${classes.length ? t("Keep it up! See you in class. Trevor") : t("Keep it up! Trevor")} ${t("You can turn this email off in Settings > Preferences.")}`,
      }),
    };
  },

  /**
   * Sundays, to a private student with a class this week: the week's classes
   * with their Meet links, classes completed and what's left in the package.
   * Written in the language they're learning first, then in their own
   * language (their site language, or the other of the two). The footer says
   * how to turn it off (Trevor, 2026-10-03: the option fairly visible).
   */
  weeklyClassUpdate(person: ClassUpdate): Email | null {
    if (!person.email || person.classes.length === 0) return null;
    const first: SiteLanguage = person.learning === "English" ? "en" : "pt";
    const site = emailLanguage(person.site_language);
    const second: SiteLanguage = site === "es" || site === "fr" ? site : first === "en" ? "pt" : "en";
    const zone = person.timezone || LESSON_TIMEZONE;
    const left = person.class_package ? person.class_package - ((person.completed ?? 0) % person.class_package) : null;
    const settings = `${SITE_URL}/settings`;

    const part = (lang: SiteLanguage) => {
      const t = translator(lang);
      const classes = person.classes.map((c): [string, string, string?] => [
        t("Class"),
        `${studentDateTime(c.start, zone, lang)} (${formatInTimeZone(new Date(c.start), zone, "zzz")})`,
        c.meet_link ?? undefined,
      ]);
      const progress: [string, string][] = [[t("Classes completed"), String(person.completed ?? 0)]];
      if (left !== null) progress.push([t("Left in your package"), t("{left} of {total}", { left, total: person.class_package! })]);
      return {
        t,
        sections: [
          { title: t("Your classes this week"), rows: classes },
          { title: t("Your progress"), rows: progress },
        ],
      };
    };
    const a = part(first);
    const b = part(second);
    const optOut = (t: Translate) => t("Don't want this weekly email? Turn it off at {url} (Settings > Preferences > Emails).", { url: settings });
    return {
      to: person.email,
      subject: a.t("Your classes this week"),
      ...renderEmail({
        heading: greeting(person.full_name, a.t),
        intro: `${a.t("Here are your classes this week. Tap a class to open its Meet link.")} ${b.t("Here are your classes this week. Tap a class to open its Meet link.")}`,
        details: [],
        sections: [...a.sections, ...b.sections],
        button: { label: a.t("Open your schedule"), url: `${SITE_URL}/dashboard` },
        footerNote: `${a.t("See you in class! Trevor")} ${optOut(a.t)} ${optOut(b.t)}`,
      }),
    };
  },

  /**
   * On Mondays, to a student who chose article emails: the articles released
   * today in the language they're learning (the caller picks them), written
   * in their site language.
   */
  newArticles(person: ArticleReader, articles: LessonCatalog): Email | null {
    if (!person.email || articles.length === 0) return null;
    const t = translator(emailLanguage(person.site_language));
    const link = (id: string) => `https://englishandportuguesewithtrevor.com/lessons/#/${id}`;
    const one = articles.length === 1;
    return {
      to: person.email,
      subject: one ? t("New article: {title}", { title: articles[0].title }) : t("New articles to read"),
      ...renderEmail({
        heading: greeting(person.full_name, t),
        intro: one ? t("There's a new article for you today.") : t("There are new articles for you today."),
        details: [],
        sections: [{ title: t("Out today"), rows: articles.map((a): [string, string, string] => [t("Article"), a.title, link(a.id)]) }],
        button: { label: t("Read it"), url: link(articles[0].id) },
        footerNote: t("You get this email because you asked for it. You can change this in Settings > Preferences."),
      }),
    };
  },

  /** New sign-ups and subscribers (admin_alerts), one email per batch. Flags wait for the morning email. */
  adminAlerts(alerts: AlertRow[]): Email | null {
    const to = adminEmail();
    if (!to || alerts.length === 0) return null;
    const row = (a: AlertRow): [string, string] => [
      a.name || "No name",
      [a.email, formatInTimeZone(new Date(a.created_at), LESSON_TIMEZONE, "MMM d, h:mm a zzz")].filter(Boolean).join(" · "),
    ];
    const button = { label: "Open alerts", url: `${SITE_URL}/admin/alerts` };
    if (alerts.length === 1) {
      const [alert] = alerts;
      return {
        to,
        subject: `${alertTitle(alert.kind)}: ${alert.name || alert.email || "someone"}`,
        ...renderEmail({
          heading: alert.kind === "subscriber" ? "Someone subscribed to the lessons" : "Someone created an account",
          details: [
            ["Name", alert.name || "No name"],
            ...(alert.email ? ([["Email", alert.email]] as [string, string][]) : []),
          ],
          button,
        }),
      };
    }
    const signups = alerts.filter((a) => a.kind === "signup");
    const subscribers = alerts.filter((a) => a.kind === "subscriber");
    return {
      to,
      subject: `${alerts.length} new alerts`,
      ...renderEmail({
        heading: `${alerts.length} new alerts`,
        details: [],
        sections: [
          { title: "New subscribers", rows: subscribers.map(row) },
          { title: "New sign-ups", rows: signups.map(row) },
        ],
        button,
      }),
    };
  },
};

async function attempt(label: string, work: () => Promise<void>) {
  try {
    await work();
    return true;
  } catch (error) {
    // A Google hiccup must never undo or block a booking; log it, flag it
    // on the admin Overview, and move on.
    console.error(`[notifications] ${label} failed:`, error);
    const detail = error instanceof Error ? error.message : String(error);
    await recordGoogleStatus(false, `${label} failed: ${detail}`);
    return false;
  }
}

async function send(email: Email | null) {
  return email ? attempt(`email "${email.subject}"`, () => sendEmail(email)) : true;
}

/** Sends one notification; failures are logged and flagged, never thrown. Resolves false if the email failed. */
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
    await recordMeeting(supabase, lesson.bookingId, event.eventId, event.meetLink ?? "");
  });
  return meetLink;
}

/**
 * Records the meeting on the booking. Only the server may do this, so it
 * proves itself with the job secret rather than the student's session.
 */
async function recordMeeting(supabase: Supabase, bookingId: string, eventId: string, meetLink: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set, so the Meet link can't be recorded");
  const { error } = await createServerJobClient().rpc("set_booking_meeting", {
    p_booking_id: bookingId,
    p_event_id: eventId,
    p_meet_link: meetLink,
    p_secret: secret,
  });
  if (!error) return;
  // Until migration 20260928091500 is applied the database still has the
  // older three-argument function; fall back to it. Remove once applied.
  const missing = error.code === "PGRST202" || /could not find the function/i.test(error.message ?? "");
  if (!missing) throw error;
  const legacy = await (supabase.rpc as unknown as (name: string, args: Record<string, string>) => Promise<{ error: unknown }>)(
    "set_booking_meeting",
    { p_booking_id: bookingId, p_event_id: eventId, p_meet_link: meetLink },
  );
  if (legacy.error) throw legacy.error;
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
  await Promise.all([send(emails.confirmed(lesson, meetLink)), send(emails.adminConfirmed(lesson, meetLink))]);
}

/** The admin booked a student in directly; the calendar invite is the student's notice. */
export async function afterAdminBooking(supabase: Supabase, lesson: Lesson) {
  if (!configured()) return;
  const meetLink = await scheduleMeeting(supabase, lesson);
  await Promise.all([send(emails.confirmed(lesson, meetLink)), send(emails.adminBooked(lesson, meetLink))]);
}

/** A run of classes the admin booked at once: a calendar invite for each, one email to the student, one to the admin. */
export async function afterAdminSeries(supabase: Supabase, lessons: Lesson[], skipped: { start: string; reason: string }[]) {
  if (!configured()) return;
  const meetLinks: (string | null)[] = [];
  for (const lesson of lessons) meetLinks.push(await scheduleMeeting(supabase, lesson));
  // One branded email to the student listing every lesson (Google's own invite comes for each too).
  const toStudent = lessons.length === 1 ? emails.confirmed(lessons[0], meetLinks[0]) : emails.seriesBooked(lessons, meetLinks);
  await Promise.all([send(toStudent), send(emails.adminBookedSeries(lessons, skipped))]);
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
  await Promise.all([send(emails.rescheduled(lesson, meetLink)), send(emails.adminRescheduled(lesson, meetLink))]);
}

export async function afterCancellation(
  lesson: Lesson,
  how: { by: "student" | "admin"; wasPending: boolean; late: boolean; eventId: string | null },
) {
  if (!configured()) return;
  if (lesson.rescheduledFrom) {
    // A reschedule request, not a lesson: the original stays untouched.
    if (how.by === "student") await send(emails.adminRescheduleWithdrawn(lesson));
    else await Promise.all([send(emails.rescheduleDeclined(lesson)), send(emails.adminTeacherCancelled(lesson, how))]);
    return;
  }
  if (how.eventId) {
    const eventId = how.eventId;
    await attempt("delete calendar event", () => deleteLessonEvent(eventId));
  }
  if (how.by === "student") {
    await send(emails.adminStudentCancelled(lesson, how));
  } else {
    await Promise.all([
      send(how.wasPending ? emails.declined(lesson) : emails.cancelledByTeacher(lesson)),
      send(emails.adminTeacherCancelled(lesson, how)),
    ]);
  }
}
