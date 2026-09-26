import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkGoogleConnection: vi.fn(async () => ({ ok: true, message: "ok" })),
  recordGoogleStatus: vi.fn(async () => {}),
  sendNotification: vi.fn<(email: { to: string; subject: string } | null) => Promise<void>>(async () => {}),
  rpc: vi.fn(),
}));
vi.mock("@/lib/google", () => ({ checkGoogleConnection: mocks.checkGoogleConnection }));
vi.mock("@/lib/integration-status", () => ({
  recordGoogleStatus: mocks.recordGoogleStatus,
  createServerJobClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  sendNotification: mocks.sendNotification,
}));

import { runDailyJob } from "@/lib/daily-job";
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

beforeEach(() => {
  vi.stubEnv("ADMIN_NOTIFY_EMAIL", "trevor@example.com");
  vi.stubEnv("CRON_SECRET", "s3cret");
  mocks.rpc.mockImplementation(async (fn: string) => {
    if (fn === "admin_timezone") return { data: "America/Denver", error: null };
    if (fn === "claim_student_reminders") return { data: [reminderRow], error: null };
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
    expect(result).toEqual({ google: "ok", reminders: 1, agenda: true });
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
