// @vitest-environment jsdom
process.env.TZ = "America/Denver";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CancelBookingDialog,
  isLateCancellation,
  type CancellableBooking,
} from "@/components/cancel-booking-dialog";

// Thursday Sep 24, 3 PM MT.
const NOW = new Date("2026-09-24T21:00:00Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

function renderDialog(booking: CancellableBooking, onCancel = vi.fn(async () => null as string | null)) {
  const onClose = vi.fn();
  render(<CancelBookingDialog booking={booking} onClose={onClose} onCancel={onCancel} />);
  return { onCancel, onClose, user: userEvent.setup() };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

describe("isLateCancellation", () => {
  it("is late for a confirmed session less than 24 hours away", () => {
    expect(isLateCancellation({ id: "b", startTime: hoursFromNow(23.9), status: "CONFIRMED" }, NOW)).toBe(true);
  });

  it("is not late at exactly 24 hours or more", () => {
    expect(isLateCancellation({ id: "b", startTime: hoursFromNow(24), status: "CONFIRMED" }, NOW)).toBe(false);
  });

  it("never counts a request that was never approved", () => {
    expect(isLateCancellation({ id: "b", startTime: hoursFromNow(2), status: "PENDING" }, NOW)).toBe(false);
  });
});

describe("CancelBookingDialog", () => {
  it("warns that a late cancellation still counts, then cancels", async () => {
    const { user, onCancel } = renderDialog({ id: "b1", startTime: hoursFromNow(5), status: "CONFIRMED" });
    expect(screen.getByText("Cancel this session?")).toBeInTheDocument();
    expect(screen.getByText(/less than 24 hours, so it will still count as a class/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel anyway" }));
    expect(onCancel).toHaveBeenCalledWith("b1");
  });

  it("doesn't warn with more notice", () => {
    renderDialog({ id: "b1", startTime: hoursFromNow(48), status: "CONFIRMED" });
    expect(screen.queryByText(/still count/)).not.toBeInTheDocument();
    expect(screen.getByText("The time will open up for other students.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel session" })).toBeInTheDocument();
  });

  it("lets a student withdraw a pending request without a warning", () => {
    renderDialog({ id: "b1", startTime: hoursFromNow(5), status: "PENDING" });
    expect(screen.getByText("Withdraw this request?")).toBeInTheDocument();
    expect(screen.queryByText(/still count/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw request" })).toBeInTheDocument();
  });

  it("does nothing if the student keeps the booking", async () => {
    const { user, onCancel, onClose } = renderDialog({ id: "b1", startTime: hoursFromNow(5), status: "CONFIRMED" });
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the error and stays open if cancelling fails", async () => {
    const onCancel = vi.fn(async () => "Booking not found.");
    const { user, onClose } = renderDialog({ id: "b1", startTime: hoursFromNow(48), status: "CONFIRMED" }, onCancel);
    await user.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(screen.getByText("Booking not found.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
