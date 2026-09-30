import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "admin" as string | null,
  confirmBooking: vi.fn(async () => ({ error: null })),
  cancelBooking: vi.fn(async () => ({ error: null })),
  adminBookStudent: vi.fn(async () => ({ error: null })),
  adminBookSeries: vi.fn(async () => ({ error: null, booked: 2, skipped: [] })),
  sendTestPush: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/admin-push", () => ({ sendTestPush: mocks.sendTestPush }));
vi.mock("@/lib/actions/bookings", () => ({
  confirmBooking: mocks.confirmBooking,
  cancelBooking: mocks.cancelBooking,
  adminBookStudent: mocks.adminBookStudent,
  adminBookSeries: mocks.adminBookSeries,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.role ? { id: "u1" } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: mocks.role } }) }) }) }),
  }),
}));

import { OPTIONS, POST } from "@/app/api/admin/route";

const ORIGIN = "https://englishandportuguesewithtrevor.com";
const post = (body: unknown, origin = ORIGIN) =>
  POST(
    new Request("https://schedule.test/api/admin", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

afterEach(() => {
  mocks.role = "admin";
  vi.clearAllMocks();
});

describe("POST /api/admin", () => {
  it("answers the dashboard's preflight for its origin only", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("refuses other origins, signed-out callers and students", async () => {
    expect((await post({ action: "confirm", bookingId: "b1" }, "https://evil.test")).status).toBe(403);
    mocks.role = null;
    expect((await post({ action: "confirm", bookingId: "b1" })).status).toBe(401);
    mocks.role = "student";
    expect((await post({ action: "confirm", bookingId: "b1" })).status).toBe(403);
    expect(mocks.confirmBooking).not.toHaveBeenCalled();
  });

  it("runs the same booking actions as the admin pages", async () => {
    expect(await (await post({ action: "confirm", bookingId: "b1" })).json()).toEqual({ error: null });
    expect(mocks.confirmBooking).toHaveBeenCalledWith("b1");
    await post({ action: "cancel", bookingId: "b2", reason: "Sick" });
    expect(mocks.cancelBooking).toHaveBeenCalledWith("b2", "Sick");
    await post({ action: "book", studentId: "s1", start: "2026-10-01T16:00:00.000Z", end: "2026-10-01T17:00:00.000Z" });
    expect(mocks.adminBookStudent).toHaveBeenCalledWith("s1", "2026-10-01T16:00:00.000Z", "2026-10-01T17:00:00.000Z");
  });

  it("sends a test notification to the calling device only, with a message", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await post({ action: "test-push", endpoint: "https://push/e1", body: "  " })).status).toBe(400);
    await post({ action: "test-push", endpoint: "https://push/e1", title: "", body: " Hello " });
    expect(mocks.sendTestPush).toHaveBeenCalledWith("s3cret", "https://push/e1", "Test notification", "Hello");
    vi.unstubAllEnvs();
  });

  it("books a weekly series in one call, within the limit", async () => {
    const slots = [
      { start: "2026-10-01T16:00:00.000Z", end: "2026-10-01T17:00:00.000Z" },
      { start: "2026-10-08T16:00:00.000Z", end: "2026-10-08T17:00:00.000Z" },
    ];
    expect(await (await post({ action: "book-series", studentId: "s1", slots })).json()).toEqual({ error: null, booked: 2, skipped: [] });
    expect(mocks.adminBookSeries).toHaveBeenCalledWith("s1", slots);
    expect((await post({ action: "book-series", studentId: "s1", slots: [] })).status).toBe(400);
    expect((await post({ action: "book-series", studentId: "s1", slots: Array(27).fill(slots[0]) })).status).toBe(400);
    expect((await post({ action: "book-series", studentId: "s1", slots: [{ start: "x", end: "y" }] })).status).toBe(400);
  });

  it("rejects a bad time or unknown action", async () => {
    expect((await post({ action: "book", studentId: "s1", start: "nope", end: "nope" })).status).toBe(400);
    expect((await post({ action: "explode" })).status).toBe(400);
  });
});
