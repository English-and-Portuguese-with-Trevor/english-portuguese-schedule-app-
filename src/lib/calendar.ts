import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import type { AvailabilityRule } from "@/lib/types";

/** The admin calendar's two views. */
export type CalendarView = "month" | "week";

/** Weeks start on Monday, like the Availability page. */
const WEEK = { weekStartsOn: 1 } as const;

export function parseView(value: string | string[] | undefined): CalendarView {
  return value === "week" ? "week" : "month";
}

/** A `?date=2026-09-29` value as a local date, or null when missing or invalid. */
export function parseDateParam(value: string | string[] | undefined): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parse(value, "yyyy-MM-dd", new Date());
  return isValid(date) ? date : null;
}

export const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

/** The days shown for a view: whole Monday-to-Sunday weeks covering the month, or one week. */
export function visibleDays(view: CalendarView, anchor: Date): Date[] {
  const first = view === "month" ? startOfWeek(startOfMonth(anchor), WEEK) : startOfWeek(anchor, WEEK);
  const last = view === "month" ? endOfWeek(endOfMonth(anchor), WEEK) : endOfWeek(anchor, WEEK);
  const count = differenceInCalendarDays(last, first) + 1;
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** The anchor date one month or week earlier (-1) or later (1). */
export function shiftAnchor(view: CalendarView, anchor: Date, step: -1 | 1): Date {
  return view === "month" ? addMonths(anchor, step) : addWeeks(anchor, step);
}

export interface Window {
  start: Date;
  end: Date;
  rule: AvailabilityRule;
}

/**
 * The active weekly availability windows that fall on the given calendar
 * dates, as real instants. A rule's weekday and times are read in its own
 * time zone, so dates one before and after are included too: in another
 * zone a window can land on the neighboring date.
 */
export function availabilityWindows(rules: AvailabilityRule[], days: Date[]): Window[] {
  if (days.length === 0) return [];
  const windows: Window[] = [];
  const from = addDays(days[0], -1);
  const count = days.length + 2;
  for (let i = 0; i < count; i++) {
    const date = addDays(from, i);
    const dateStr = dayKey(date);
    for (const rule of rules) {
      if (!rule.is_active || rule.day_of_week !== getDay(date)) continue;
      windows.push({
        start: fromZonedTime(`${dateStr}T${rule.start_time}`, rule.timezone),
        end: fromZonedTime(`${dateStr}T${rule.end_time}`, rule.timezone),
        rule,
      });
    }
  }
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The part of each item that falls on `day` (this device's time zone), cut at midnight. */
export function clipToDay<T extends { start: Date; end: Date }>(items: T[], day: Date): T[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = addDays(dayStart, 1);
  return items
    .filter((item) => item.start < dayEnd && item.end > dayStart)
    .map((item) => ({
      ...item,
      start: item.start < dayStart ? dayStart : item.start,
      end: item.end > dayEnd ? dayEnd : item.end,
    }));
}

/**
 * Side-by-side lanes for overlapping blocks in the week view (a canceled
 * class and the new one booked in its place, say). Items must be sorted by
 * start. Each gets its lane and how many lanes its overlapping group uses.
 */
export function assignLanes<T extends { start: Date; end: Date }>(
  items: T[],
): (T & { lane: number; lanes: number })[] {
  const placed: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let groupEnd = 0;
  const closeGroup = () => {
    const lanes = Math.max(0, ...group.map((g) => g.lane)) + 1;
    for (const g of group) g.lanes = lanes;
  };
  for (const item of items) {
    if (group.length > 0 && item.start.getTime() >= groupEnd) {
      closeGroup();
      group = [];
    }
    const taken = new Set(
      group.filter((g) => g.end.getTime() > item.start.getTime()).map((g) => g.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane++;
    const entry = { ...item, lane, lanes: 1 };
    group.push(entry);
    placed.push(entry);
    groupEnd = Math.max(groupEnd, item.end.getTime());
  }
  if (group.length > 0) closeGroup();
  return placed;
}

/** Minutes since local midnight, for placing blocks on the week's time axis. */
export function minutesIntoDay(date: Date, day: Date): number {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return Math.round((date.getTime() - dayStart.getTime()) / 60000);
}

/**
 * The hours the week view shows: 8 AM to 8 PM, widened to fit anything
 * earlier or later.
 */
export function hourRange(items: { start: Date; end: Date }[], days: Date[]): { first: number; last: number } {
  let first = 8;
  let last = 20;
  for (const day of days) {
    for (const item of clipToDay(items, day)) {
      first = Math.min(first, Math.floor(minutesIntoDay(item.start, day) / 60));
      last = Math.max(last, Math.ceil(minutesIntoDay(item.end, day) / 60));
    }
  }
  return { first, last };
}
