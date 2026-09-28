import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendNotification: vi.fn(),
}));
vi.mock("@/lib/integration-status", () => ({ createServerJobClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("web-push", () => ({
  default: { sendNotification: mocks.sendNotification, generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }) },
}));

import { POST } from "@/app/api/alerts/push/route";
import { sendAlertPushes } from "@/lib/admin-push";
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

  it("sums up several alerts in one notification", () => {
    expect(pushMessage([signup, { ...signup, id: 3 }, subscriber])).toMatchObject({
      title: "3 new alerts",
      body: "2 new sign-ups, 1 new subscriber",
    });
  });
});

describe("sendAlertPushes", () => {
  it("sends the claimed alerts to every device", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([signup]), error: null });
    expect(await sendAlertPushes("s3cret")).toEqual({ alerts: 1, sent: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_alert_pushes", { p_secret: "s3cret" });
    const [target, payload, options] = mocks.sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: "https://push.example/a", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(payload)).toMatchObject({ title: "New sign-up" });
    expect(options.vapidDetails).toMatchObject({ publicKey: "pub", privateKey: "priv" });
  });

  it("forgets devices the push service says are gone, and keeps going", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([subscriber]), error: null });
    mocks.sendNotification.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));
    expect(await sendAlertPushes("s3cret")).toEqual({ alerts: 1, sent: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("drop_push_subscription", {
      p_secret: "s3cret",
      p_endpoint: "https://push.example/a",
    });
  });

  it("sends nothing without alerts, devices or keys", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimed([]), error: null });
    expect(await sendAlertPushes("s3cret")).toEqual({ alerts: 0, sent: 0 });
    mocks.rpc.mockResolvedValueOnce({ data: claimed([signup], []), error: null });
    expect(await sendAlertPushes("s3cret")).toEqual({ alerts: 1, sent: 0 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: { ...claimed([signup]), vapid_private_key: null }, error: null });
    expect(await sendAlertPushes("s3cret")).toEqual({ alerts: 1, sent: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
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
    expect(await res.json()).toEqual({ alerts: 1, sent: 2 });
  });
});
