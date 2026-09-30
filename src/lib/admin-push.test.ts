import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendNotification: vi.fn(),
  sendEmail: vi.fn<(email: { to: string; subject: string }) => Promise<void>>(async () => {}),
  isGoogleConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/google", () => ({
  isGoogleConfigured: mocks.isGoogleConfigured,
  sendEmail: mocks.sendEmail,
  LESSON_TIMEZONE: "America/Denver",
}));
vi.mock("@/lib/integration-status", () => ({ createServerJobClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("web-push", () => ({
  default: { sendNotification: mocks.sendNotification, generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }) },
}));

import { POST } from "@/app/api/alerts/push/route";
import { GET as flagsCron } from "@/app/api/cron/flags/route";
import { sendAlerts } from "@/lib/admin-push";
import { pushMessage, type AlertRow } from "@/lib/alerts";

const signup: AlertRow = { id: 1, kind: "signup", name: "Ana Pereira", email: "ana@example.com", created_at: "2026-09-28T12:00:00Z" };
const subscriber: AlertRow = { id: 2, kind: "subscriber", name: null, email: "bo@example.com", created_at: "2026-09-28T12:01:00Z" };
const devices = [
  { endpoint: "https://push.example/a", p256dh: "k1", auth: "a1" },
  { endpoint: "https://push.example/b", p256dh: "k2", auth: "a2" },
];

function claimed(alerts: AlertRow[], subscriptions = devices) {
  return { alerts, subscriptions, vapid_public_key: "pub", vapid_private_key: "priv" };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("ADMIN_NOTIFY_EMAIL", "trevor@example.com");
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.sendNotification.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("pushMessage", () => {
  it("names the person for a single alert", () => {
    expect(pushMessage([signup])).toMatchObject({
      title: "New sign-up",
      body: "Ana Pereira (ana@example.com) created an account.",
      url: "/admin/alerts",
    });
    expect(pushMessage([subscriber])).toMatchObject({
      title: "New subscriber",
      body: "bo@example.com subscribed to the lessons.",
    });
  });

  it("says which class was flagged and why", () => {
    const flag: AlertRow = { ...signup, id: 4, kind: "flag", reason: "connection", class_start: "2026-09-28T20:30:00Z" };
    expect(pushMessage([flag])).toMatchObject({
      title: "Class flagged",
      body: "Ana Pereira (ana@example.com): Connection or Meet problem · class Mon, Sep 28, 2:30 PM MDT",
    });
    expect(pushMessage([flag, signup]).body).toBe("1 flagged class, 1 new sign-up");
    const report: AlertRow = { ...signup, id: 6, kind: "report", reason: "answer", item: "Activities: Present tense › Question 3" };
    expect(pushMessage([report])).toMatchObject({
      title: "Issue reported",
      body: "Ana Pereira (ana@example.com): Wrong answer or grading · Activities: Present tense › Question 3",
    });
  });

  it("sums up several alerts in one notification", () => {
    expect(pushMessage([signup, { ...signup, id: 3 }, subscriber])).toMatchObject({
      title: "3 new alerts",
      body: "2 new sign-ups, 1 new subscriber",
    });
  });
});

describe("sendAlerts", () => {
  it("emails the claimed alerts and pushes them to every device", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([signup]), error: null });
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 1, emailed: true, sent: 2 });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: "trevor@example.com", subject: "New sign-up: Ana Pereira" });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_alert_pushes", { p_secret: "s3cret" });
    const [target, payload, options] = mocks.sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: "https://push.example/a", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(payload)).toMatchObject({ title: "New sign-up" });
    expect(options.vapidDetails).toMatchObject({ publicKey: "pub", privateKey: "priv" });
  });

  it("forgets devices the push service says are gone, and keeps going", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([subscriber]), error: null });
    mocks.sendNotification.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 1, emailed: true, sent: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("drop_push_subscription", {
      p_secret: "s3cret",
      p_endpoint: "https://push.example/a",
    });
  });

  it("sends nothing when there are no new alerts", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([]), error: null });
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 0, emailed: false, sent: 0 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("still emails without push devices or keys", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([signup], []), error: null });
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 1, emailed: true, sent: 0 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: { ...claimed([signup]), vapid_private_key: null }, error: null });
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 1, emailed: true, sent: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("pushes a flagged class at once but leaves its email for the morning", async () => {
    const flag: AlertRow = { ...signup, id: 5, kind: "flag", reason: "other", class_start: "2026-09-28T20:30:00Z" };
    mocks.rpc.mockResolvedValueOnce({ data: claimed([flag]), error: null });
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 1, emailed: false, sent: 2 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("still pushes when Gmail isn't set up", async () => {
    mocks.isGoogleConfigured.mockReturnValueOnce(false);
    mocks.rpc.mockResolvedValueOnce({ data: claimed([signup]), error: null });
    expect(await sendAlerts("s3cret")).toEqual({ alerts: 1, emailed: false, sent: 2 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/alerts/push", () => {
  it("refuses a request without the job secret", async () => {
    const res = await POST(new Request("http://x/api/alerts/push", { method: "POST" }));
    expect(res.status).toBe(401);
    const wrong = await POST(
      new Request("http://x/api/alerts/push", { method: "POST", headers: { authorization: "Bearer nope" } }),
    );
    expect(wrong.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends with the right secret", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([signup]), error: null });
    const res = await POST(
      new Request("http://x/api/alerts/push", { method: "POST", headers: { authorization: "Bearer s3cret" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alerts: 1, emailed: true, sent: 2 });
  });
});

describe("GET /api/cron/flags", () => {
  const call = () => flagsCron(new Request("http://x/api/cron/flags", { headers: { authorization: "Bearer s3cret" } }));
  const flag: AlertRow = { ...signup, kind: "flag", reason: "connection", class_start: "2026-09-28T20:30:00Z" };

  afterEach(() => vi.useRealTimers());

  it("emails the flags at 6:30 AM in Denver, summer or winter", async () => {
    for (const utc of ["2026-09-30T12:30:00Z", "2026-12-01T13:30:00Z"]) {
      vi.useFakeTimers({ now: new Date(utc), toFake: ["Date"] });
      mocks.rpc.mockResolvedValueOnce({ data: [flag], error: null });
      expect(await (await call()).json()).toEqual({ flags: 1 });
    }
    expect(mocks.rpc).toHaveBeenCalledWith("claim_flag_digest", { p_secret: "s3cret" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ subject: "1 new flag" });
  });

  it("skips the other run, and sends nothing without flags", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T13:30:00Z"), toFake: ["Date"] }); // 7:30 AM in summer
    expect(await (await call()).json()).toEqual({ skipped: "not 6 AM in Denver" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    vi.useFakeTimers({ now: new Date("2026-09-30T12:30:00Z"), toFake: ["Date"] });
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await (await call()).json()).toEqual({ flags: 0 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a request without the job secret", async () => {
    expect((await flagsCron(new Request("http://x/api/cron/flags"))).status).toBe(401);
  });
});
