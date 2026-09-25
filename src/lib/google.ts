/**
 * Talks to Google as the business account (englishportuguesewithtrevor@gmail.com)
 * using a long-lived OAuth refresh token: Calendar for lesson events with Meet
 * links, Gmail for notification emails.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const LESSON_TIMEZONE = "America/Denver";
const SENDER_NAME = "English & Portuguese with Trevor";
// The account the refresh token belongs to; Gmail only sends as this address.
export const SENDER_EMAIL = "englishportuguesewithtrevor@gmail.com";

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN,
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function googleFetch(url: string, init: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok) throw new Error(`Google API ${init.method} ${url} failed: ${res.status} ${await res.text()}`);
  return res;
}

/**
 * Creates the lesson on the business calendar with a Meet link and invites
 * the student; Google emails them the invitation.
 */
export async function createLessonEvent(lesson: {
  bookingId: string;
  start: string;
  end: string;
  studentEmail: string | null;
  studentName: string;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const res = await googleFetch(`${CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: `Lesson: ${lesson.studentName} & Trevor`,
      description: "1:1 lesson with English & Portuguese with Trevor.\nManage your lessons: https://schedule.englishandportuguesewithtrevor.com",
      start: { dateTime: lesson.start, timeZone: LESSON_TIMEZONE },
      end: { dateTime: lesson.end, timeZone: LESSON_TIMEZONE },
      attendees: lesson.studentEmail ? [{ email: lesson.studentEmail }] : [],
      conferenceData: {
        // Same booking → same request, so a retry can't create a second meeting.
        createRequest: { requestId: lesson.bookingId, conferenceSolutionKey: { type: "hangoutsMeet" } },
      },
      reminders: { useDefault: true },
    }),
  });
  const event = (await res.json()) as { id: string; hangoutLink?: string };
  return { eventId: event.id, meetLink: event.hangoutLink ?? null };
}

/** Deletes the lesson event; Google emails the student the cancellation. */
export async function deleteLessonEvent(eventId: string) {
  try {
    await googleFetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: "DELETE",
    });
  } catch (error) {
    // Already deleted by hand in Google Calendar: nothing left to do.
    if (error instanceof Error && /failed: 410/.test(error.message)) return;
    throw error;
  }
}

function encodeHeader(value: string) {
  // RFC 2047, so names and subjects outside ASCII (e.g. Portuguese) survive.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

export function buildRawEmail(email: { to: string; subject: string; text: string }) {
  const message = [
    `From: ${encodeHeader(SENDER_NAME)} <${SENDER_EMAIL}>`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(email.text).toString("base64"),
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

export async function sendEmail(email: { to: string; subject: string; text: string }) {
  await googleFetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildRawEmail(email) }),
  });
}
