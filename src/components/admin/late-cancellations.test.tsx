// @vitest-environment jsdom
process.env.TZ = "America/Denver";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LateCancellations } from "@/components/admin/late-cancellations";

const names = { s1: "Ana P.", s2: "Bruno S." };

describe("LateCancellations", () => {
  it("lists who cancelled, which class, and how much notice they gave", () => {
    render(
      <LateCancellations
        displayNames={names}
        rows={[
          {
            id: "b1",
            student_id: "s1",
            cancelled_at: "2026-09-28T15:00:00Z", // 9 AM MT
            session_slots: { start_time: "2026-09-28T20:00:00Z" }, // Mon 2 PM MT
          },
          {
            id: "b2",
            student_id: "s2",
            cancelled_at: "2026-09-29T20:40:00Z",
            session_slots: { start_time: "2026-09-29T21:00:00Z" },
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Late cancellations (2)" })).toBeInTheDocument();
    expect(screen.getByText(/clears after 7 days/)).toBeInTheDocument();
    expect(screen.getByText("Ana P.")).toBeInTheDocument();
    expect(screen.getByText("Mon, Sep 28 at 2:00 PM · cancelled 5 hours before")).toBeInTheDocument();
    expect(screen.getByText("Tue, Sep 29 at 3:00 PM · cancelled 20 min before")).toBeInTheDocument();
  });

  it("says so when there are none", () => {
    render(<LateCancellations displayNames={names} rows={[]} />);
    expect(screen.getByRole("heading", { name: "Late cancellations (0)" })).toBeInTheDocument();
    expect(screen.getByText("None in the last week.")).toBeInTheDocument();
  });
});
