import { describe, expect, it } from "vitest";

import {
  assignLanes,
  availabilityWindows,
  clipToDay,
  dayKey,
  hourRange,
  parseDateParam,
  parseView,
  shiftAnchor,
  visibleDays,
} from "@/lib/calendar";
import type { AvailabilityRule } from "@/lib/types";

// Runs in UTC (vitest.config.mts), like the server; the calendar's own
// device-zone math uses the same functions.

function rule(overrides: Partial<AvailabilityRule>): AvailabilityRule {
  return {
    id: "r1",
    day_of_week: 1,
    start_time: "09:00:00",
    end_time: "12:00:00",
    slot_duration_minutes: 60,
    timezone: "America/Denver",
    is_active: true,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as AvailabilityRule;
}

const d = (s: string) => parseDateParam(s)!;
const at = (iso: string) => new Date(iso);

describe("URL params", () => {
  it("defaults to the month view and ignores unknown values", () => {
    expect(parseView(undefined)).toBe("month");
    expect(parseView("week")).toBe("week");
    expect(parseView("year")).toBe("month");
  });

  it("reads yyyy-MM-dd dates and rejects anything else", () => {
    expect(dayKey(d("2026-09-29"))).toBe("2026-09-29");
    expect(parseDateParam("2026-02-30")).toBeNull();
    expect(parseDateParam("tomorrow")).toBeNull();
    expect(parseDateParam(["2026-09-29"])).toBeNull();
    expect(parseDateParam(undefined)).toBeNull();
  });
});

describe("visibleDays", () => {
  it("covers the month in whole Monday-to-Sunday weeks", () => {
    const days = visibleDays("month", d("2026-09-15")).map(dayKey);
    expect(days[0]).toBe("2026-08-31"); // Monday before Sept 1 (a Tuesday)
    expect(days.at(-1)).toBe("2026-10-04"); // Sunday after Sept 30
    expect(days).toHaveLength(35);
  });

  it("uses six weeks when the month needs them", () => {
    // August 2026 starts on a Saturday and ends on a Monday.
    const days = visibleDays("month", d("2026-08-10")).map(dayKey);
    expect(days[0]).toBe("2026-07-27");
    expect(days.at(-1)).toBe("2026-09-06");
    expect(days).toHaveLength(42);
  });

  it("shows one week, Monday first, even when the anchor is a Sunday", () => {
    expect(visibleDays("week", d("2026-09-29")).map(dayKey)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(dayKey(visibleDays("week", d("2026-10-04"))[0])).toBe("2026-09-28");
  });

  it("steps a month or a week at a time", () => {
    expect(dayKey(shiftAnchor("month", d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(dayKey(shiftAnchor("week", d("2026-09-29"), -1))).toBe("2026-09-22");
  });
});

describe("availabilityWindows", () => {
  const week = visibleDays("week", d("2026-09-29"));

  it("places each active weekly window on its weekday, in the rule's own zone", () => {
    const windows = availabilityWindows([rule({})], week);
    const inWeek = windows.flatMap((w) => clipToDay([w], week[0]));
    expect(inWeek).toHaveLength(1);
    // 9 AM Denver (MDT, UTC-6) on Monday Sept 28.
    expect(inWeek[0].start.toISOString()).toBe("2026-09-28T15:00:00.000Z");
    expect(inWeek[0].end.toISOString()).toBe("2026-09-28T18:00:00.000Z");
  });

  it("skips windows that are turned off", () => {
    expect(availabilityWindows([rule({ is_active: false })], week)).toEqual([]);
  });

  it("follows daylight saving time", () => {
    // Denver is UTC-7 again after Nov 1, 2026.
    const [monday] = visibleDays("week", d("2026-11-02"));
    const [w] = clipToDay(availabilityWindows([rule({})], [monday]), monday);
    expect(w.start.toISOString()).toBe("2026-11-02T16:00:00.000Z");
  });

  it("includes a window from the day before that lands on a shown day in this zone", () => {
    // Sunday 8-11 PM Denver is Monday 2-5 AM UTC.
    const [monday] = week;
    const windows = availabilityWindows(
      [rule({ day_of_week: 0, start_time: "20:00:00", end_time: "23:00:00" })],
      [monday],
    );
    const [w] = clipToDay(windows, monday);
    expect(w.start.toISOString()).toBe("2026-09-28T02:00:00.000Z");
  });
});

describe("clipToDay", () => {
  it("cuts an item that crosses midnight at the day's edges", () => {
    const item = { start: at("2026-09-28T23:00:00Z"), end: at("2026-09-29T01:00:00Z") };
    expect(clipToDay([item], d("2026-09-28"))[0].end.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(clipToDay([item], d("2026-09-29"))[0].start.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(clipToDay([item], d("2026-09-30"))).toEqual([]);
  });
});

describe("assignLanes", () => {
  it("puts overlapping blocks side by side and leaves the rest full width", () => {
    const items = [
      { id: "a", start: at("2026-09-29T15:00:00Z"), end: at("2026-09-29T16:00:00Z") },
      { id: "b", start: at("2026-09-29T15:30:00Z"), end: at("2026-09-29T16:30:00Z") },
      { id: "c", start: at("2026-09-29T16:00:00Z"), end: at("2026-09-29T17:00:00Z") },
      { id: "d", start: at("2026-09-29T18:00:00Z"), end: at("2026-09-29T19:00:00Z") },
    ];
    expect(assignLanes(items).map(({ id, lane, lanes }) => [id, lane, lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2], // a has ended, so c reuses its lane
      ["d", 0, 1],
    ]);
  });
});

describe("hourRange", () => {
  it("shows 8 AM to 8 PM, widened for anything outside it", () => {
    const day = d("2026-09-29");
    expect(hourRange([], [day])).toEqual({ first: 8, last: 20 });
    const early = { start: at("2026-09-29T06:30:00Z"), end: at("2026-09-29T07:30:00Z") };
    const late = { start: at("2026-09-29T20:00:00Z"), end: at("2026-09-29T21:15:00Z") };
    expect(hourRange([early, late], [day])).toEqual({ first: 6, last: 22 });
  });
});
