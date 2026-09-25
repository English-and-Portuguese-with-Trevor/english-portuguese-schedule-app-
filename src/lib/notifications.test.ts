import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const google = vi.hoisted(() => ({
  isGoogleConfigured: vi.fn(() => true),
  createLessonEvent: vi.fn(async () => ({ eventId: "evt1", meetLink: "https://meet.google.com/abc-defg-hij" })),
  deleteLessonEvent: vi.fn(async () => {}),
  sendEmail: vi.fn<(email: { to: string; subject: string; text: string; html?: string }) => Promise<void>>(async () => {}),
}));
vi.mock("@/lib/google", () => ({ ...google, LESSON_TIMEZONE: "America/Denver" }));

import {
  afterAdminBooking,
  afterApproval,
  afterCancellation,
  afterStudentBooking,
  lessonWhen,
  type Lesson,
} from "@/lib/notifications";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const lesson: Lesson = {
  bookingId: "b1",
  start: "2026-09-28T20:30:00Z", // Mon 2:30 PM MT
  end: "2026-09-28T21:30:00Z",
  studentName: "Ana Pereira",
  studentEmail: "ana@example.com",
};

const rpc = vi.fn(async () => ({ error: null }));
const supabase = { rpc } as unknown as Supabase;

const sentEmails = () => google.sendEmail.mock.calls.map(([email]) => email);
const sentTo = () => sentEmails().map((email) => email.to);
const subjects = () => sentEmails().map((email) => email.subject);

beforeEach(() => {
  vi.stubEnv("ADMIN_NOTIFY_EMAIL", "trevor@example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("lessonWhen", () => {
  it("shows the start, end, date, and time zone name", () => {
    expect(lessonWhen(lesson, "America/Denver")).toBe(
      "2:30 PM – 3:30 PM, Monday, September 28, 2026 (Mountain Daylight Time)",
    );
    expect(lessonWhen(lesson, "America/Sao_Paulo")).toBe(
      "5:30 PM – 6:30 PM, Monday, September 28, 2026 (Brasilia Standard Time)",
    );
  });
});

describe("time zones", () => {
  const abroad = { ...lesson, studentTimezone: "America/Sao_Paulo" };

  it("shows the student only their own time", async () => {
    await afterApproval(supabase, abroad);
    const [email] = sentEmails();
    expect(email.subject).toBe("Lesson confirmed: Mon, Sep 28, 5:30 PM");
    expect(email.text).toContain("Date/time: 5:30 PM – 6:30 PM, Monday, September 28, 2026 (Brasilia Standard Time)");
    expect(email.text).not.toContain("Mountain");
  });

  it("shows the admin both their time and the student's", async () => {
    await afterStudentBooking(supabase, abroad, true);
    const email = sentEmails().find((e) => e.to === "trevor@example.com")!;
    expect(email.subject).toBe("Approval needed: Ana Pereira, Mon, Sep 28, 2:30 PM");
    expect(email.text).toContain("Your time: 2:30 PM – 3:30 PM, Monday, September 28, 2026 (Mountain Daylight Time)");
    expect(email.text).toContain("Student's time: 5:30 PM – 6:30 PM, Monday, September 28, 2026 (Brasilia Standard Time)");
  });

  it("shows one time when the student is in Mountain Time too", async () => {
    await afterStudentBooking(supabase, { ...lesson, studentTimezone: "America/Denver" }, true);
    const email = sentEmails().find((e) => e.to === "trevor@example.com")!;
    expect(email.text).not.toContain("Student's time");
  });
});

describe("the email template", () => {
  it("names the lesson, carries the taglines, and escapes names in the HTML", async () => {
    await afterApproval(supabase, { ...lesson, studentName: "Ana <b>Pereira</b>" });
    const [email] = sentEmails();
    expect(email.text).toContain("Lesson: English / Portuguese Lesson (60 min)");
    expect(email.text).toContain("Let's go :)");
    expect(email.text).toContain("Vamos lá :)");
    expect(email.html).toContain('href="https://meet.google.com/abc-defg-hij"');
    expect(email.html).not.toContain("<b>Pereira</b>");
  });
});

describe("a student booking", () => {
  it("72+ hours out: creates the Meet event, records it, and tells the admin", async () => {
    await afterStudentBooking(supabase, lesson, false);

    expect(google.createLessonEvent).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", studentEmail: "ana@example.com", start: lesson.start }),
    );
    expect(rpc).toHaveBeenCalledWith("set_booking_meeting", {
      p_booking_id: "b1",
      p_event_id: "evt1",
      p_meet_link: "https://meet.google.com/abc-defg-hij",
    });
    expect(sentTo().sort()).toEqual(["ana@example.com", "trevor@example.com"]);
    expect(subjects()).toContain("New lesson: Ana Pereira, Mon, Sep 28, 2:30 PM");
    expect(subjects()).toContain("Lesson confirmed: Mon, Sep 28, 2:30 PM");
  });

  it("under 72 hours: no meeting yet; the student hears it's pending and the admin is asked to approve", async () => {
    await afterStudentBooking(supabase, lesson, true);

    expect(google.createLessonEvent).not.toHaveBeenCalled();
    expect(sentTo().sort()).toEqual(["ana@example.com", "trevor@example.com"]);
    expect(subjects()).toContain("Approval needed: Ana Pereira, Mon, Sep 28, 2:30 PM");
    const studentEmail = sentEmails().find((e) => e.to === "ana@example.com")!;
    expect(studentEmail.text).toContain("Hi Ana,");
    expect(studentEmail.text).toContain("needs to approve it first");
  });
});

describe("approval", () => {
  it("creates the Meet event and emails the student the link", async () => {
    await afterApproval(supabase, lesson);

    expect(google.createLessonEvent).toHaveBeenCalledOnce();
    expect(sentTo()).toEqual(["ana@example.com"]);
    const [email] = sentEmails();
    expect(email.subject).toBe("Lesson confirmed: Mon, Sep 28, 2:30 PM");
    expect(email.text).toContain("https://meet.google.com/abc-defg-hij");
  });
});

describe("admin booking a student in", () => {
  it("creates the event; the calendar invitation is the only notice", async () => {
    await afterAdminBooking(supabase, lesson);
    expect(google.createLessonEvent).toHaveBeenCalledOnce();
    expect(google.sendEmail).not.toHaveBeenCalled();
  });
});

describe("cancellation", () => {
  it("by a student, late: removes the event and flags it to the admin", async () => {
    await afterCancellation(lesson, { by: "student", wasPending: false, late: true, eventId: "evt1" });

    expect(google.deleteLessonEvent).toHaveBeenCalledWith("evt1");
    expect(subjects()).toEqual(["Late cancellation: Ana Pereira, Mon, Sep 28, 2:30 PM"]);
    const [email] = sentEmails();
    expect(email.text).toContain("still counts as a class");
  });

  it("by a student withdrawing a request: says so, with no event to remove", async () => {
    await afterCancellation(lesson, { by: "student", wasPending: true, late: false, eventId: null });

    expect(google.deleteLessonEvent).not.toHaveBeenCalled();
    expect(subjects()).toEqual(["Request withdrawn: Ana Pereira, Mon, Sep 28, 2:30 PM"]);
  });

  it("by the admin declining a request: tells the student", async () => {
    await afterCancellation(lesson, { by: "admin", wasPending: true, late: false, eventId: null });
    expect(sentTo()).toEqual(["ana@example.com"]);
    expect(subjects()).toEqual(["Lesson request not available: Mon, Sep 28, 2:30 PM"]);
  });

  it("by the admin cancelling a confirmed lesson: removes the event and tells the student", async () => {
    await afterCancellation(lesson, { by: "admin", wasPending: false, late: false, eventId: "evt1" });
    expect(google.deleteLessonEvent).toHaveBeenCalledWith("evt1");
    expect(subjects()).toEqual(["Lesson cancelled: Mon, Sep 28, 2:30 PM"]);
  });
});

describe("failure handling", () => {
  it("does nothing until Google is configured", async () => {
    google.isGoogleConfigured.mockReturnValueOnce(false);
    await afterStudentBooking(supabase, lesson, false);
    expect(google.createLessonEvent).not.toHaveBeenCalled();
    expect(google.sendEmail).not.toHaveBeenCalled();
  });

  it("still emails if the calendar event fails, and never throws", async () => {
    google.createLessonEvent.mockRejectedValueOnce(new Error("Google is down"));
    await expect(afterApproval(supabase, lesson)).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    expect(sentTo()).toEqual(["ana@example.com"]);
    expect(console.error).toHaveBeenCalled();
  });

  it("skips admin emails when no admin address is set", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "");
    await afterStudentBooking(supabase, lesson, false);
    expect(sentTo()).toEqual(["ana@example.com"]);
  });
});

describe("booking questions", () => {
  it("shows the student's answers in the admin's email, not the student's", async () => {
    await afterStudentBooking(supabase, { ...lesson, language: "PORTUGUESE", whatsapp: "+1 540 623 8596" }, false);
    const admin = sentEmails().find((e) => e.to === "trevor@example.com")!;
    const student = sentEmails().find((e) => e.to === "ana@example.com")!;
    expect(admin.text).toContain("Are you looking for English or Portuguese lessons?\nPortuguese");
    expect(admin.text).toContain("WhatsApp number\n+1 540 623 8596");
    expect(admin.html).toContain("Questions");
    expect(student.text).not.toContain("WhatsApp");
  });
});
