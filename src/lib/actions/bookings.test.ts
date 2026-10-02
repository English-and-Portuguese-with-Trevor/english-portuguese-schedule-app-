import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  outcome: "approved" as string,
  admin: { ok: true, adminId: "admin1" } as { ok: boolean; adminId?: string; error?: string },
  rpc: vi.fn(),
  afterApproval: vi.fn(async () => {}),
  afterRescheduleApproval: vi.fn(async () => {}),
}));

const booking = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: "CONFIRMED",
  late_cancellation: false,
  google_event_id: id === "orig" ? "event1" : null,
  meet_link: id === "orig" ? "https://meet/x" : null,
  reschedule_of: null,
  student_timezone: "America/Sao_Paulo",
  lesson_language: "ENGLISH",
  whatsapp: null,
  session_slots: { start_time: "2026-10-10T16:00:00Z", end_time: "2026-10-10T17:00:00Z" },
  profiles: { full_name: "Ana", email: "ana@example.com", timezone: "America/Sao_Paulo" },
  ...extra,
});
const rows: Record<string, ReturnType<typeof booking>> = {};

const client = {
  rpc: mocks.rpc,
  from: () => ({
    select: () => ({ eq: (_: string, id: string) => ({ single: async () => ({ data: rows[id] ?? null }) }) }),
  }),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/lib/auth/require-admin", () => ({ checkAdmin: async () => mocks.admin }));
vi.mock("next/server", () => ({ after: (work: () => unknown) => work() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/notifications", () => ({
  afterApproval: mocks.afterApproval,
  afterRescheduleApproval: mocks.afterRescheduleApproval,
}));

import { confirmBooking } from "@/lib/actions/bookings";

mocks.rpc.mockImplementation(async (name: string) =>
  name === "approve_booking" ? { data: mocks.outcome, error: null } : { data: "America/Denver", error: null },
);

afterEach(() => {
  mocks.admin = { ok: true, adminId: "admin1" };
  vi.clearAllMocks();
});

describe("confirmBooking", () => {
  it("approves through approve_booking and sends the approval", async () => {
    rows.new1 = booking("new1");
    mocks.outcome = "approved";
    expect(await confirmBooking("new1")).toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenCalledWith("approve_booking", { p_booking_id: "new1" });
    expect(mocks.afterApproval).toHaveBeenCalledOnce();
    expect(mocks.afterRescheduleApproval).not.toHaveBeenCalled();
  });

  it("moves the original's calendar event when a reschedule is approved", async () => {
    rows.orig = booking("orig", { status: "CANCELLED" });
    rows.new2 = booking("new2", { reschedule_of: "orig" });
    mocks.outcome = "rescheduled";
    expect(await confirmBooking("new2")).toEqual({ error: null });
    expect(mocks.afterRescheduleApproval).toHaveBeenCalledOnce();
    expect(mocks.afterRescheduleApproval.mock.calls[0]).toMatchObject([client, { bookingId: "new2" }, { id: "orig", eventId: "event1" }]);
    expect(mocks.afterApproval).not.toHaveBeenCalled();
  });

  it("books a fresh lesson when the original was canceled while the request waited", async () => {
    rows.orig = booking("orig", { status: "CANCELLED" });
    rows.new3 = booking("new3", { reschedule_of: "orig" });
    mocks.outcome = "original_canceled";
    await confirmBooking("new3");
    expect(mocks.afterApproval).toHaveBeenCalledOnce();
    expect(mocks.afterRescheduleApproval).not.toHaveBeenCalled();
  });

  it("sends nothing when the request isn't pending any more", async () => {
    mocks.outcome = "not_pending";
    expect(await confirmBooking("gone")).toEqual({ error: null });
    expect(mocks.afterApproval).not.toHaveBeenCalled();
    expect(mocks.afterRescheduleApproval).not.toHaveBeenCalled();
  });

  it("refuses a caller who isn't a checked admin", async () => {
    mocks.admin = { ok: false, error: "Admin only." };
    expect(await confirmBooking("new1")).toEqual({ error: "Admin only." });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
