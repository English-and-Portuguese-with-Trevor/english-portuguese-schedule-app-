import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkGoogleConnection: vi.fn(async () => ({ ok: true, message: "ok" })),
  recordGoogleStatus: vi.fn(async () => {}),
  sendNotification: vi.fn<(email: { to: string; subject: string } | null) => Promise<void>>(async () => {}),
  rpc: vi.fn(),
  sendAlerts: vi.fn(async () => ({ alerts: 0, emailed: false, sent: 0 })),
  sendWelcomes: vi.fn(async () => 0),
  sendMonthlySummaries: vi.fn(async () => 3),
  sendArticleEmails: vi.fn(async () => 2),
  sendClassUpdates: vi.fn(async () => 4),
}));
vi.mock("@/lib/admin-push", () => ({ sendAlerts: mocks.sendAlerts }));
vi.mock("@/lib/welcome", () => ({ sendWelcomes: mocks.sendWelcomes }));
vi.mock("@/lib/monthly-summary", () => ({ sendMonthlySummaries: mocks.sendMonthlySummaries }));
vi.mock("@/lib/article-emails", () => ({ sendArticleEmails: mocks.sendArticleEmails }));
vi.mock("@/lib/class-updates", () => ({ sendClassUpdates: mocks.sendClassUpdates }));
vi.mock("@/lib/google", () => ({ checkGoogleConnection: mocks.checkGoogleConnection, LESSON_TIMEZONE: "America/Denver" }));
vi.mock("@/lib/integration-status", () => ({
  recordGoogleStatus: mocks.recordGoogleStatus,
  createServerJobClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  sendNotification: mocks.sendNotification,
}));

import { runDailyJob } from "@/lib/daily-job";
import type { Email } from "@/lib/notifications";
import { GET } from "@/app/api/cron/daily/route";

const reminderRow = {
  booking_id: "b1",
  start_time: "2026-09-28T20:30:00Z",
  end_time: "2026-09-28T21:30:00Z",
  student_name: "Ana Pereira",
  student_email: "ana@example.com",
  student_timezone: "America/Sao_Paulo",
  meet_link: "https://meet.google.com/x",
};

const weeklyRow = {
  people: [
    { id: "u1", full_name: "Ana Pereira", email: "ana@example.com", created_at: "2026-09-01T00:00:00Z" },
    { id: "u2", full_name: "Bruno Costa Lima", email: "bruno@example.com", created_at: "2026-10-03T15:00:00Z" },
    { id: "u3", full_name: null, email: "quiet@example.com", created_at: "2026-08-01T00:00:00Z" },
  ],
  new_signups: ["u2"],
  new_subscribers: [],
  active_students: 2,
  lessons_finished: 3,
  puzzles_played: 5,
  activities_finished: 1,
  cards_studied: 40,
  classes_held: 2,
  classes_canceled: 1,
  late_cancellations: 1,
  upcoming: [{ start: "2026-10-06T20:00:00Z", student_id: "u1", language: "PORTUGUESE" }],
  inactive: [{ id: "u3", last_active: null }],
};

beforeEach(() => {
  // A Tuesday, 7 AM in Denver: no weekly summary unless a test says Monday.
  vi.useFakeTimers({ now: new Date("2026-09-29T13:00:00Z"), toFake: ["Date"] });
  vi.stubEnv("ADMIN_NOTIFY_EMAIL", "trevor@example.com");
  vi.stubEnv("CRON_SECRET", "s3cret");
  mocks.rpc.mockImplementation(async (fn: string) => {
    if (fn === "admin_timezone") return { data: "America/Denver", error: null };
    if (fn === "claim_student_reminders") return { data: [reminderRow], error: null };
    if (fn === "weekly_summary") return { data: weeklyRow, error: null };
    if (fn === "pill_stats") {
      return { data: { shown: 12, tapped: 3, closed: 4, unlock_shown: 2, unlock_tapped: 1, students: 5 }, error: null };
    }
    if (fn === "admin_agenda") {
      return {
        data: [{ ...reminderRow, status: "CONFIRMED", lesson_language: "PORTUGUESE", whatsapp: null, reschedule_from: null }],
        error: null,
      };
    }
    return { data: null, error: null };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runDailyJob", () => {
  it("records a healthy Google check, sends reminders, then the admin's agenda", async () => {
    const result = await runDailyJob("s3cret");

    expect(mocks.recordGoogleStatus).toHaveBeenCalledWith(true, "Daily check passed.");
    expect(mocks.rpc).toHaveBeenCalledWith("claim_student_reminders", { p_secret: "s3cret" });
    const sent = mocks.sendNotification.mock.calls.map(([email]) => email);
    expect(sent.map((e) => e?.to)).toEqual(["ana@example.com", "trevor@example.com"]);
    expect(sent[0]?.subject).toBe("Lesson reminder: Mon, Sep 28, 5:30 PM");
    expect(mocks.rpc).not.toHaveBeenCalledWith("weekly_summary", expect.anything());
    expect(result).toEqual({
      google: "ok",
      reminders: 1,
      agenda: true,
      deeplReminder: false,
      weekly: false,
      articles: 0,
      monthly: 0,
      classUpdates: 0,
    });
    expect(mocks.sendArticleEmails).not.toHaveBeenCalled();
    expect(mocks.sendClassUpdates).not.toHaveBeenCalled();
  });

  it("on Sunday morning in Denver sends the private students their week of classes", async () => {
    vi.setSystemTime(new Date("2026-10-04T13:00:00Z"));
    const result = await runDailyJob("s3cret");
    expect(mocks.sendClassUpdates).toHaveBeenCalledWith("s3cret", "2026-10-04");
    expect(result.classUpdates).toBe(4);
  });

  it("on the 1st in Denver also sends the students' monthly summaries", async () => {
    vi.setSystemTime(new Date("2026-10-01T13:00:00Z"));
    const result = await runDailyJob("s3cret");
    expect(mocks.sendMonthlySummaries).toHaveBeenCalledWith("s3cret");
    expect(result.monthly).toBe(3);
  });

  it("on Monday morning in Denver also emails Trevor the weekly summary", async () => {
    vi.setSystemTime(new Date("2026-10-05T13:00:00Z"));
    const result = await runDailyJob("s3cret");

    expect(mocks.rpc).toHaveBeenCalledWith("weekly_summary", { p_secret: "s3cret" });
    const weekly = mocks.sendNotification.mock.calls.map(([email]) => email as Email | null).at(-1);
    expect(weekly?.to).toBe("trevor@example.com");
    expect(weekly?.subject).toBe("Your week: 2 active, 1 new, 1 class ahead");
    expect(weekly?.text).toContain("Bruno L.");
    expect(weekly?.text).toContain("joined Oct 3");
    expect(weekly?.text).toContain("Classes canceled");
    expect(weekly?.text).toContain("1 (1 late)");
    expect(weekly?.text).toContain("Tue, Oct 6, 2:00 PM: Ana P. · Portuguese");
    expect(weekly?.text).toContain("quiet: never active");
    expect(result.weekly).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("pill_stats", { p_secret: "s3cret" });
    expect(weekly?.text).toContain("Suggestion pills\nShown: 12 · Tapped: 3 · Closed: 4\nUnlock everything: shown 2 · tapped 1\nStudents: 5");
  });

  it("sends the weekly summary without the pills when pill_stats fails", async () => {
    vi.setSystemTime(new Date("2026-10-05T13:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation(async (fn: string, args?: unknown) =>
      fn === "pill_stats" ? { data: null, error: { message: "function public.pill_stats does not exist" } } : rpc(fn, args),
    );
    const result = await runDailyJob("s3cret");
    const weekly = mocks.sendNotification.mock.calls.map(([email]) => email as Email | null).at(-1);
    expect(weekly?.subject).toBe("Your week: 2 active, 1 new, 1 class ahead");
    expect(weekly?.text).not.toContain("Suggestion pills");
    expect(result.weekly).toBe(true);
  });

  it("on Mondays sends the article emails for that day in Denver", async () => {
    // 1 AM UTC Tuesday is still Monday evening in Denver.
    vi.setSystemTime(new Date("2026-10-06T01:00:00Z"));
    const result = await runDailyJob("s3cret");
    expect(mocks.sendArticleEmails).toHaveBeenCalledWith("s3cret", "2026-10-05");
    expect(result.articles).toBe(2);
  });

  it("sends no DeepL reminder on the 20th while DeepL is on hold", async () => {
    // 20th at 6:00 AM in Denver; still the 20th in UTC too.
    vi.useFakeTimers({ now: new Date("2026-10-20T12:00:00Z"), toFake: ["Date"] });
    try {
      const result = await runDailyJob("s3cret");
      const sent = mocks.sendNotification.mock.calls.map(([email]) => email);
      expect(sent.map((e) => e?.subject)).not.toContain("DeepL credits reset in about a week");
      expect(result.deeplReminder).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends sign-up and subscriber alerts the database's own call missed, even while Google is down", async () => {
    mocks.checkGoogleConnection.mockResolvedValueOnce({ ok: false, message: "down" });
    await runDailyJob("s3cret");
    expect(mocks.sendAlerts).toHaveBeenCalledWith("s3cret");
    expect(mocks.sendWelcomes).toHaveBeenCalledWith("s3cret");
  });

  it("while Google is down: records it and leaves reminders unclaimed for tomorrow", async () => {
    mocks.checkGoogleConnection.mockResolvedValueOnce({ ok: false, message: "The refresh token was revoked." });
    const result = await runDailyJob("s3cret");

    expect(mocks.recordGoogleStatus).toHaveBeenCalledWith(false, "The refresh token was revoked.");
    expect(mocks.rpc).not.toHaveBeenCalledWith("claim_student_reminders", expect.anything());
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(result.reminders).toBe(0);
  });
});

describe("GET /api/cron/daily", () => {
  it("refuses requests without the secret", async () => {
    const res = await GET(new Request("https://x/api/cron/daily", { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
    expect(mocks.checkGoogleConnection).not.toHaveBeenCalled();
  });

  it("runs for Vercel Cron's authorized call", async () => {
    const res = await GET(new Request("https://x/api/cron/daily", { headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ reminders: 1 });
  });
});
