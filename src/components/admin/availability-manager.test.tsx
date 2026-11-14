// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const deleteAvailabilityRule = vi.fn();
vi.mock("@/lib/actions/availability", () => ({
  createAvailabilityRule: vi.fn(),
  toggleAvailabilityRule: vi.fn(),
  deleteAvailabilityRule: (...args: unknown[]) => deleteAvailabilityRule(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AvailabilityManager } from "@/components/admin/availability-manager";
import type { AvailabilityRule } from "@/lib/types";

const rule = {
  id: "r1",
  day_of_week: 1,
  start_time: "09:00:00",
  end_time: "17:00:00",
  slot_duration_minutes: 60,
  timezone: "America/Denver",
  is_active: true,
} as AvailabilityRule;

afterEach(() => {
  vi.restoreAllMocks();
  deleteAvailabilityRule.mockReset();
});

describe("AvailabilityManager Delete", () => {
  it("asks first and keeps the window on Cancel", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AvailabilityManager initialRules={[rule]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith("Delete the Monday window 09:00–17:00? This can't be undone.");
    expect(deleteAvailabilityRule).not.toHaveBeenCalled();
    expect(screen.getByText("09:00–17:00")).toBeInTheDocument();
  });

  it("deletes the window once confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteAvailabilityRule.mockResolvedValue({ error: null });
    render(<AvailabilityManager initialRules={[rule]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteAvailabilityRule).toHaveBeenCalledWith("r1");
    expect(screen.queryByText("09:00–17:00")).not.toBeInTheDocument();
  });
});

describe("AvailabilityManager time zone switcher", () => {
  it("shows a window on the day and at the times of the chosen zone", () => {
    // A Monday in January: Denver is UTC-7, São Paulo UTC-3.
    vi.useFakeTimers({ now: new Date("2026-01-05T18:00:00Z"), toFake: ["Date"] });
    render(
      <AvailabilityManager
        initialRules={[{ ...rule, start_time: "21:00:00", end_time: "22:00:00" }]}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Show times in" }));
    fireEvent.click(screen.getByRole("option", { name: "America/Sao_Paulo" }));

    const tuesday = screen.getByText("Tuesday").closest("li")!;
    expect(tuesday).toHaveTextContent("01:00–02:00");
    expect(tuesday).toHaveTextContent("60 min · America/Sao_Paulo");
    vi.useRealTimers();
  });

  it("offers the rest of the world once All time zones is ticked", () => {
    render(<AvailabilityManager initialRules={[rule]} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Show times in" }));
    expect(screen.queryByRole("option", { name: "Asia/Tokyo" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    fireEvent.click(screen.getByRole("checkbox", { name: "All time zones" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Show times in" }));
    expect(screen.getByRole("option", { name: "Asia/Tokyo" })).toBeInTheDocument();
  });
});
