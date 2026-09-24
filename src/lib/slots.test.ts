import { formatInTimeZone } from "date-fns-tz";
import { describe, expect, it } from "vitest";

import { generateCandidateSlots, generateUpcomingSlots, markOpenSlots } from "@/lib/slots";
import type { AvailabilityRule, SessionSlot } from "@/lib/types";

const TZ = "America/Denver";

function rule(day: number, start: string, end: string, overrides: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    id: `${day}-${start}`,
    day_of_week: day,
    start_time: start,
    end_time: end,
    slot_duration_minutes: 60,
    timezone: TZ,
    is_active: true,
    created_by: "admin",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// The real weekly schedule (Mountain Time). 0 = Sunday.
const SCHEDULE: AvailabilityRule[] = [
  rule(0, "14:00:00", "16:00:00"),
  rule(1, "14:00:00", "16:00:00"),
  rule(2, "14:00:00", "15:00:00"),
  rule(3, "10:00:00", "11:00:00"),
  rule(3, "15:00:00", "18:00:00"),
  rule(3, "19:15:00", "22:00:00"),
  rule(4, "09:00:00", "11:00:00"),
  rule(4, "15:00:00", "17:00:00"),
  rule(5, "10:00:00", "11:00:00"),
  rule(5, "15:00:00", "19:00:00"),
];

const LONG_AGO = new Date("2026-01-01T00:00:00Z");

/** Start times on one calendar date, as Mountain Time wall-clock labels. */
function startsOn(date: string, rules = SCHEDULE, now = LONG_AGO) {
  return generateCandidateSlots(rules, { fromDate: date, days: 1, now }).map((s) =>
    formatInTimeZone(s.start, TZ, "h:mm a"),
  );
}

function slot(startIso: string, endIso: string, overrides: Partial<SessionSlot> = {}): SessionSlot {
  return {
    id: startIso,
    start_time: startIso,
    end_time: endIso,
    status: "OPEN",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    notes: null,
    ...overrides,
  };
}

describe("generateCandidateSlots", () => {
  it("offers every 15-minute start whose full hour fits before the window ends", () => {
    // Monday 2–4 PM: 2:30 is bookable, 3:15 would run past 4:00.
    expect(startsOn("2026-09-28")).toEqual(["2:00 PM", "2:15 PM", "2:30 PM", "2:45 PM", "3:00 PM"]);
  });

  it("makes every session exactly one hour", () => {
    for (const s of generateCandidateSlots(SCHEDULE, { fromDate: "2026-09-28", days: 7, now: LONG_AGO })) {
      expect(s.end.getTime() - s.start.getTime()).toBe(60 * 60 * 1000);
    }
  });

  it("gives a one-hour window exactly one start", () => {
    expect(startsOn("2026-09-29")).toEqual(["2:00 PM"]); // Tuesday 2–3 PM
  });

  it("combines several windows on the same day", () => {
    const wednesday = startsOn("2026-09-30");
    expect(wednesday).toHaveLength(1 + 9 + 8); // 10–11 AM, 3–6 PM, 7:15–10 PM
    expect(wednesday[0]).toBe("10:00 AM");
    expect(wednesday).toContain("7:15 PM");
    expect(wednesday.at(-1)).toBe("9:00 PM");
    expect(wednesday).not.toContain("11:00 AM");
  });

  it("offers nothing on a day without windows", () => {
    expect(startsOn("2026-10-03")).toEqual([]); // Saturday
  });

  it("ignores inactive windows", () => {
    expect(startsOn("2026-09-28", [rule(1, "14:00:00", "16:00:00", { is_active: false })])).toEqual([]);
  });

  it("keeps Mountain Time wall-clock hours across the end of daylight saving", () => {
    const [before] = generateCandidateSlots(SCHEDULE, { fromDate: "2026-10-26", days: 1, now: LONG_AGO });
    const [after] = generateCandidateSlots(SCHEDULE, { fromDate: "2026-11-02", days: 1, now: LONG_AGO });
    expect(before.start.toISOString()).toBe("2026-10-26T20:00:00.000Z"); // 2 PM MDT
    expect(after.start.toISOString()).toBe("2026-11-02T21:00:00.000Z"); // 2 PM MST
  });

  it("drops starts that have already passed", () => {
    const now = new Date("2026-09-28T20:20:00Z"); // Monday 2:20 PM MT
    expect(startsOn("2026-09-28", SCHEDULE, now)).toEqual(["2:30 PM", "2:45 PM", "3:00 PM"]);
  });

  it("marks starts inside the 72-hour cutoff as not bookable", () => {
    const now = new Date("2026-09-24T21:00:00Z"); // Thursday 3 PM MT → cutoff Sunday 3 PM MT
    const sunday = generateCandidateSlots(SCHEDULE, { fromDate: "2026-09-27", days: 1, now });
    const bookable = Object.fromEntries(sunday.map((s) => [formatInTimeZone(s.start, TZ, "h:mm a"), s.bookable]));
    expect(bookable).toEqual({
      "2:00 PM": false,
      "2:15 PM": false,
      "2:30 PM": false,
      "2:45 PM": false,
      "3:00 PM": true, // exactly 72 hours out
    });
  });
});

describe("generateUpcomingSlots", () => {
  it("keeps the rest of tonight's slots after UTC has rolled over to tomorrow", () => {
    // Wednesday 8 PM Mountain is already Thursday 02:00 in UTC (the server clock).
    const now = new Date("2026-10-01T02:00:00Z");
    const slots = generateUpcomingSlots(SCHEDULE, { now, days: 7 });
    expect(formatInTimeZone(slots[0].start, TZ, "EEE h:mm a")).toBe("Wed 8:00 PM");
  });

  it("never returns a start in the past", () => {
    const now = new Date("2026-09-30T18:00:00Z");
    expect(generateUpcomingSlots(SCHEDULE, { now, days: 7 }).every((s) => s.start >= now)).toBe(true);
  });
});

describe("markOpenSlots", () => {
  // Wednesday 3–6 PM MT window, with a booked 4–5 PM session.
  const wednesday = generateCandidateSlots([rule(3, "15:00:00", "18:00:00")], {
    fromDate: "2026-09-30",
    days: 1,
    now: LONG_AGO,
  });
  const booked = slot("2026-09-30T22:00:00Z", "2026-09-30T23:00:00Z");
  const labels = (slots: { start: Date }[]) => slots.map((s) => formatInTimeZone(s.start, TZ, "h:mm a"));

  it("removes every start that would overlap a booked session, not just the exact match", () => {
    const open = markOpenSlots(wednesday, [booked], { [booked.id]: 1 });
    expect(labels(open)).toEqual(["3:00 PM", "5:00 PM"]); // back-to-back is fine
  });

  it("ignores a slot whose only booking was cancelled", () => {
    expect(markOpenSlots(wednesday, [booked], {})).toHaveLength(wednesday.length);
  });

  it("ignores a cancelled slot", () => {
    const cancelled = { ...booked, status: "CANCELLED" as const };
    expect(markOpenSlots(wednesday, [cancelled], { [booked.id]: 1 })).toHaveLength(wednesday.length);
  });
});
