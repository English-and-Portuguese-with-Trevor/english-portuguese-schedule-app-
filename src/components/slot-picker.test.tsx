// @vitest-environment jsdom
process.env.TZ = "America/Denver"; // the viewer's browser timezone

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SlotPicker, type BusySlotDTO } from "@/components/slot-picker";
import { generateUpcomingSlots } from "@/lib/slots";
import type { AvailabilityRule, Role } from "@/lib/types";

function rule(day: number, start: string, end: string): AvailabilityRule {
  return {
    id: `${day}-${start}`,
    day_of_week: day,
    start_time: start,
    end_time: end,
    slot_duration_minutes: 60,
    timezone: "America/Denver",
    is_active: true,
    created_by: "admin",
    created_at: "2026-01-01T00:00:00Z",
  };
}

const SCHEDULE = [
  rule(0, "14:00:00", "16:00:00"),
  rule(1, "14:00:00", "16:00:00"),
  rule(4, "09:00:00", "11:00:00"),
  rule(4, "15:00:00", "17:00:00"),
];

// Thursday Sep 24, 3 PM MT. The 72h cutoff lands on Sunday 3 PM.
const NOW = new Date("2026-09-24T21:00:00Z");
// Monday Sep 28, 2:30–3:30 PM MT.
const MONDAY_BOOKING: BusySlotDTO = {
  start: "2026-09-28T20:30:00Z",
  end: "2026-09-28T21:30:00Z",
  studentName: "Trevor L. 1",
};

function renderPicker(role: Role, onBook = vi.fn(async () => null as string | null)) {
  const candidates = generateUpcomingSlots(SCHEDULE, { now: NOW, days: 14 }).map((c) => ({
    start: c.start.toISOString(),
    end: c.end.toISOString(),
    bookable: c.bookable,
  }));
  render(<SlotPicker role={role} candidates={candidates} busySlots={[MONDAY_BOOKING]} onBook={onBook} />);
  return { onBook, user: userEvent.setup() };
}

function dayChip(label: string) {
  return screen.getByRole("button", { name: new RegExp(`^${label},`) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

describe("SlotPicker", () => {
  it("shows two weeks of days starting today", () => {
    renderPicker("student");
    expect(dayChip("Thursday, September 24")).toBeInTheDocument();
    expect(dayChip("Wednesday, October 7")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Thursday, October 8,/ })).not.toBeInTheDocument();
  });

  it("opens students on the first day they can actually book", () => {
    renderPicker("student");
    // Thursday and Friday are inside the 72h cutoff; Sunday 3 PM is exactly 72h out.
    expect(screen.getByRole("heading", { name: "Sunday, September 27" })).toBeInTheDocument();
    expect(dayChip("Sunday, September 27")).toHaveAccessibleName("Sunday, September 27, 1 open");
    expect(dayChip("Sunday, September 27")).toHaveAttribute("aria-pressed", "true");
  });

  it("marks days without availability", () => {
    renderPicker("student");
    expect(dayChip("Saturday, September 26")).toHaveAccessibleName("Saturday, September 26, no availability");
  });

  it("shows a booked session and strikes out every start that would overlap it", async () => {
    const { user } = renderPicker("student");
    await user.click(dayChip("Monday, September 28"));

    expect(screen.getByText(/2:30 – 3:30 PM · Booked/)).toBeInTheDocument();
    expect(screen.queryByText(/Trevor L\. 1/)).not.toBeInTheDocument(); // students don't see who
    for (const time of ["2:00 PM", "2:15 PM", "2:30 PM", "2:45 PM", "3:00 PM"]) {
      const button = screen.getByRole("button", { name: time });
      expect(button).toBeDisabled();
      expect(button).toHaveClass("line-through");
    }
  });

  it("shows admins who booked", async () => {
    const { user } = renderPicker("admin");
    await user.click(dayChip("Monday, September 28"));
    expect(screen.getByText(/Booked \(Trevor L\. 1\)/)).toBeInTheDocument();
  });

  it("disables times inside the 72-hour cutoff for students but not for admins", async () => {
    const student = renderPicker("student");
    await student.user.click(dayChip("Thursday, September 24"));
    expect(screen.getByRole("button", { name: "3:30 PM" })).toBeDisabled();
    expect(screen.getByText("Times within 72 hours can't be requested online.")).toBeInTheDocument();
  });

  it("lets admins book inside the cutoff", async () => {
    const admin = renderPicker("admin");
    await admin.user.click(dayChip("Thursday, September 24"));
    expect(screen.getByRole("button", { name: "3:30 PM" })).toBeEnabled();
  });

  it("asks for confirmation, then books the exact hour picked", async () => {
    const { user, onBook } = renderPicker("student");
    await user.click(screen.getByRole("button", { name: "3:00 PM" })); // Sunday

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Request this session?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Sunday, September 27 · 3:00 – 4:00 PM/)).toBeInTheDocument();
    expect(onBook).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Request" }));
    expect(onBook).toHaveBeenCalledWith("2026-09-27T21:00:00.000Z", "2026-09-27T22:00:00.000Z");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows the error inside it when booking fails", async () => {
    const onBook = vi.fn(async () => "That time was just taken. Please pick another.");
    const { user } = renderPicker("student", onBook);
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    await user.click(screen.getByRole("button", { name: "Request" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("That time was just taken. Please pick another.")).toBeInTheDocument();
  });

  it("does nothing when the student backs out", async () => {
    const { user, onBook } = renderPicker("student");
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBook).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
