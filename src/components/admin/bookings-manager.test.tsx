// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/bookings", () => ({ adminBookStudent: vi.fn(), cancelBooking: vi.fn(), confirmBooking: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = { on: () => channel, subscribe: () => channel };
    return { channel: () => channel, removeChannel: vi.fn() };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { BookingsManager } from "@/components/admin/bookings-manager";
import type { AdminBookingRow } from "@/components/admin/booking-parts";

function booking(id: string, student_id: string, is_admin_override: boolean, status = "CONFIRMED"): AdminBookingRow {
  return {
    id,
    student_id,
    status,
    is_admin_override,
    meet_link: null,
    reschedule_of: null,
    lesson_language: null,
    whatsapp: null,
    session_slots: { start_time: "2026-10-05T15:00:00Z", end_time: "2026-10-05T16:00:00Z" },
  };
}

describe("BookingsManager's who-booked filter", () => {
  it("shows every confirmed class, then only the students' own, then only Trevor's", () => {
    render(
      <BookingsManager
        initialBookings={[booking("b1", "ana", false), booking("b2", "jesse", true), booking("b3", "bo", false, "PENDING")]}
        lateCancellations={[]}
        students={[]}
        displayNames={{ ana: "Ana P.", jesse: "Jesse D.", bo: "Bo L." }}
      />,
    );
    expect(screen.getByText("Confirmed upcoming (2)")).toBeInTheDocument();
    expect(screen.getByText("Pending requests (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Booked by students" }));
    expect(screen.getByText("Confirmed upcoming (1)")).toBeInTheDocument();
    expect(screen.getByText("Ana P.")).toBeInTheDocument();
    expect(screen.queryByText("Jesse D.")).not.toBeInTheDocument();
    // Requests are always the students' own; the filter leaves them alone.
    expect(screen.getByText("Bo L.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Booked by me" }));
    expect(screen.getByText("Jesse D.")).toBeInTheDocument();
    expect(screen.queryByText("Ana P.")).not.toBeInTheDocument();
  });
});
