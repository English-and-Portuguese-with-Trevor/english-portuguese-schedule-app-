// @vitest-environment jsdom
process.env.TZ = "America/Denver"; // the viewer's browser timezone

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SlotPicker, type BusySlotDTO } from "@/components/slot-picker";
import { generateUpcomingSlots } from "@/lib/slots";
import type { AvailabilityRule, BookingAnswers, Role } from "@/lib/types";

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

// Thursday Sep 24, 3 PM MT. Bookings are auto-confirmed from Sunday 3 PM (72h out).
const NOW = new Date("2026-09-24T21:00:00Z");
// Monday Sep 28, 2:30–3:30 PM MT.
const MONDAY_BOOKING: BusySlotDTO = {
  start: "2026-09-28T20:30:00Z",
  end: "2026-09-28T21:30:00Z",
  studentName: "Trevor L. 1",
};

type OnBook = (start: string, end: string, answers?: BookingAnswers) => Promise<string | null>;

function renderPicker(
  role: Role,
  onBook = vi.fn<OnBook>(async () => null),
  previousAnswers?: Partial<BookingAnswers>,
  rescheduleFrom?: string,
) {
  const candidates = generateUpcomingSlots(SCHEDULE, { now: NOW, days: 14 }).map((c) => ({
    start: c.start.toISOString(),
    end: c.end.toISOString(),
    needsApproval: c.needsApproval,
  }));
  render(<SlotPicker role={role} candidates={candidates} busySlots={[MONDAY_BOOKING]} onBook={onBook} previousAnswers={previousAnswers} rescheduleFrom={rescheduleFrom} />);
  return { onBook, user: userEvent.setup() };
}

async function answerQuestions(user: ReturnType<typeof userEvent.setup>) {
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("radio", { name: "Portuguese" }));
  await user.type(within(dialog).getByLabelText(/WhatsApp number/), "+1 540 623 8596");
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

  it("opens on the first day with open times, which can be today", () => {
    renderPicker("student");
    expect(screen.getByRole("heading", { name: "Thursday, September 24" })).toBeInTheDocument();
    // 3:00–4:00 PM starts are left in today's 3–5 PM window.
    expect(dayChip("Thursday, September 24")).toHaveAccessibleName("Thursday, September 24, 5 open");
    expect(dayChip("Thursday, September 24")).toHaveAttribute("aria-pressed", "true");
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

  it("lets students request times within 72 hours, marked as needing approval", async () => {
    const { user, onBook } = renderPicker("student");
    const soon = screen.getByRole("button", { name: "3:30 PM, needs approval" }); // today
    expect(soon).toBeEnabled();
    expect(soon).toHaveClass("border-dashed");
    expect(screen.getByText(/Dashed times are less than 72 hours away/)).toBeInTheDocument();

    await user.click(soon);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Request this session?")).toBeInTheDocument();
    expect(within(dialog).getByText(/stays pending until Trevor approves it/)).toBeInTheDocument();
    await answerQuestions(user);
    await user.click(within(dialog).getByRole("button", { name: "Request" }));
    expect(onBook).toHaveBeenCalledWith("2026-09-24T21:30:00.000Z", "2026-09-24T22:30:00.000Z", {
      language: "PORTUGUESE",
      whatsapp: "+1 540 623 8596",
    });
  });

  it("doesn't mark times as needing approval for admins, whose bookings are always confirmed", async () => {
    const { user } = renderPicker("admin");
    const soon = screen.getByRole("button", { name: "3:30 PM" });
    expect(soon).not.toHaveClass("border-dashed");
    expect(screen.queryByText(/Dashed times/)).not.toBeInTheDocument();

    await user.click(soon);
    expect(within(screen.getByRole("dialog")).getByText("Book this session?")).toBeInTheDocument();
  });

  it("asks for confirmation, then books the exact hour picked", async () => {
    const { user, onBook } = renderPicker("student");
    await user.click(dayChip("Sunday, September 27"));
    await user.click(screen.getByRole("button", { name: "3:00 PM" })); // exactly 72 hours out

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Book this session?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Sunday, September 27 · 3:00 – 4:00 PM/)).toBeInTheDocument();
    expect(within(dialog).getByText("It's confirmed as soon as you book.")).toBeInTheDocument();
    expect(onBook).not.toHaveBeenCalled();

    await answerQuestions(user);
    await user.click(within(dialog).getByRole("button", { name: "Book" }));
    expect(onBook).toHaveBeenCalledWith("2026-09-27T21:00:00.000Z", "2026-09-27T22:00:00.000Z", {
      language: "PORTUGUESE",
      whatsapp: "+1 540 623 8596",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows the error inside it when booking fails", async () => {
    const onBook = vi.fn<OnBook>(async () => "That time was just taken. Please pick another.");
    const { user } = renderPicker("student", onBook);
    await user.click(dayChip("Sunday, September 27"));
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    await answerQuestions(user);
    await user.click(screen.getByRole("button", { name: "Book" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("That time was just taken. Please pick another.")).toBeInTheDocument();
  });

  it("does nothing when the student backs out", async () => {
    const { user, onBook } = renderPicker("student");
    await user.click(dayChip("Sunday, September 27"));
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBook).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires the language; WhatsApp is optional but must look like a number", async () => {
    const { user } = renderPicker("student");
    await user.click(dayChip("Sunday, September 27"));
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    const dialog = screen.getByRole("dialog");
    const book = within(dialog).getByRole("button", { name: "Book" });

    expect(book).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "English" }));
    expect(book).toBeEnabled(); // no WhatsApp is fine
    await user.type(within(dialog).getByLabelText(/WhatsApp number/), "not a number");
    expect(book).toBeDisabled();
    expect(within(dialog).getByText("That doesn't look like a phone number.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/WhatsApp number/));
    await user.type(within(dialog).getByLabelText(/WhatsApp number/), "+55 11 91234-5678");
    expect(book).toBeEnabled();
  });

  it("prefills the student's last answers", async () => {
    const { user, onBook } = renderPicker("student", undefined, { language: "ENGLISH", whatsapp: "+55 11 91234-5678" });
    await user.click(dayChip("Sunday, September 27"));
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "English" })).toBeChecked();
    expect(within(dialog).getByLabelText(/WhatsApp number/)).toHaveValue("+55 11 91234-5678");

    await user.click(within(dialog).getByRole("button", { name: "Book" }));
    expect(onBook).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      language: "ENGLISH",
      whatsapp: "+55 11 91234-5678",
    });
  });

  it("doesn't ask admins the booking questions", async () => {
    const { user } = renderPicker("admin");
    await user.click(screen.getByRole("button", { name: "3:30 PM" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("WhatsApp number")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Book" })).toBeEnabled();
  });

  it("in reschedule mode, asks no questions and makes clear the old lesson stays until approved", async () => {
    const { user, onBook } = renderPicker("student", undefined, undefined, "2026-09-28T20:30:00.000Z");
    await user.click(dayChip("Sunday, September 27"));
    await user.click(screen.getByRole("button", { name: "3:00 PM" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Request this new time?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Monday, September 28 at 2:30 PM stays booked until/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/WhatsApp number/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Request" }));
    expect(onBook).toHaveBeenCalledWith("2026-09-27T21:00:00.000Z", "2026-09-27T22:00:00.000Z", undefined);
  });
});
