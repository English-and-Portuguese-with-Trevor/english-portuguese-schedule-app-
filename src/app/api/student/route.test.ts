import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  profile: { role: "student", lesson_access: "granted", class_package: 8 },
  rules: [] as unknown[],
  slots: [] as unknown[],
  moveBooking: vi.fn(async () => ({ error: null, outcome: "moved" })),
  cancelBooking: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/actions/bookings", () => ({
  moveBooking: mocks.moveBooking,
  cancelBooking: mocks.cancelBooking,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const answer = async () => ({
        data:
          table === "availability_rules"
            ? mocks.rules
            : table === "session_slots"
              ? mocks.slots
              : table === "profiles"
                ? mocks.profile
                : [],
      });
      for (const m of ["select", "eq", "gt", "lte", "gte"])
        chain[m] = () => chain;
      chain.single = answer;
      chain.then = (resolve: (v: unknown) => void) => answer().then(resolve);
      return chain;
    },
  }),
}));

import { OPTIONS, POST } from "@/app/api/student/route";

const ORIGIN = "https://englishandportuguesewithtrevor.com";
const post = (body: unknown, origin = ORIGIN) =>
  POST(
    new Request("https://schedule.test/api/student", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

afterEach(() => {
  mocks.user = { id: "u1" };
  mocks.rules = [];
  mocks.slots = [];
  vi.clearAllMocks();
});

describe("POST /api/student", () => {
  it("answers the main site's preflight for its origin only", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("refuses other origins and signed-out callers", async () => {
    expect(
      (await post({ action: "free-slots" }, "https://evil.test")).status,
    ).toBe(403);
    expect((await post({ action: "nope" })).status).toBe(400);
    mocks.user = null;
    expect((await post({ action: "free-slots" })).status).toBe(401);
  });

  it("lists free times from the windows, leaving out taken ones, with no names", async () => {
    // One window on every weekday, 9 to 11 in Denver, for a long time from now.
    mocks.rules = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      id: `r${d}`,
      day_of_week: d,
      start_time: "09:00:00",
      end_time: "11:00:00",
      slot_duration_minutes: 60,
      timezone: "America/Denver",
      is_active: true,
    }));
    const res = await post({ action: "free-slots", days: 2 });
    expect(res.status).toBe(200);
    const { slots } = await res.json();
    expect(slots.length).toBeGreaterThan(0);
    expect(Object.keys(slots[0])).toEqual(["start", "end", "needsApproval"]);
    // A taken slot blocks the candidates that overlap it.
    const first = slots[0];
    mocks.slots = [
      {
        id: "s1",
        start_time: first.start,
        end_time: first.end,
        status: "OPEN",
      },
    ];
    const { slots: after } = await (
      await post({ action: "free-slots", days: 2 })
    ).json();
    expect(after.some((s: { start: string }) => s.start === first.start)).toBe(
      false,
    );
  });

  it("moves and cancels through the booking actions", async () => {
    const res = await post({
      action: "move",
      bookingId: "b1",
      start: "2026-11-06T17:00:00Z",
      end: "2026-11-06T18:00:00Z",
      timezone: "America/Sao_Paulo",
    });
    expect(await res.json()).toEqual({ error: null, outcome: "moved" });
    expect(mocks.moveBooking).toHaveBeenCalledWith(
      "b1",
      "2026-11-06T17:00:00.000Z",
      "2026-11-06T18:00:00.000Z",
      "America/Sao_Paulo",
    );
    expect(
      (await post({ action: "move", bookingId: "b1", start: "x", end: "y" }))
        .status,
    ).toBe(400);
    await post({ action: "cancel", bookingId: "b1" });
    expect(mocks.cancelBooking).toHaveBeenCalledWith("b1", undefined);
  });
});
