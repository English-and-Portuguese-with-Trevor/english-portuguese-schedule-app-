// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/bookings", () => ({ cancelBooking: vi.fn(), confirmBooking: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { BookingItem, type AdminBookingRow } from "@/components/admin/booking-parts";

function booking(status: string): AdminBookingRow {
  return {
    id: "b1",
    student_id: "s1",
    status,
    is_admin_override: false,
    meet_link: null,
    reschedule_of: null,
    lesson_language: null,
    whatsapp: null,
    session_slots: { start_time: "2026-10-05T15:00:00Z", end_time: "2026-10-05T16:00:00Z" },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("BookingItem asks before canceling or declining", () => {
  it.each([
    ["CONFIRMED", "Cancel", "Cancel Ana's class on 9:00 AM? This can't be undone."],
    ["PENDING", "Decline", "Decline Ana's request for 9:00 AM?"],
  ])("%s: %s", (status, button, question) => {
    const onCancel = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <BookingItem
        booking={booking(status)}
        name="Ana"
        when="9:00 AM"
        originalStart={null}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(confirm).toHaveBeenCalledWith(question);
    expect(onCancel).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(onCancel).toHaveBeenCalledWith("b1");
  });
});
