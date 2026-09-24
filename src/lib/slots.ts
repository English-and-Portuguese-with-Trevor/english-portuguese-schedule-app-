import { addDays, addMinutes, format, getDay, isBefore, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import { APPROVAL_WINDOW_HOURS, type AvailabilityRule, type SessionSlot } from "@/lib/types";

/** Students can request an individual session starting on any 15-minute mark. */
export const BOOKING_START_STEP_MINUTES = 15;

export interface CandidateSlot {
  start: Date;
  end: Date;
  ruleId: string;
  /** true if the slot starts within 72 hours, so a student's request needs approval */
  needsApproval: boolean;
}

/**
 * Expands an admin's recurring weekly availability windows into concrete
 * candidate start/end instants over a date range, stepping every 15 minutes.
 * A candidate is only produced if the full session fits before the window's
 * end time — the end time itself is never a valid start. Does not know about
 * existing bookings yet — see `markOpenSlots`.
 */
export function generateCandidateSlots(
  rules: AvailabilityRule[],
  opts: { fromDate: string; days: number; now?: Date },
): CandidateSlot[] {
  const now = opts.now ?? new Date();
  const autoConfirmFrom = addMinutes(now, APPROVAL_WINDOW_HOURS * 60);
  const rangeStart = parseISO(opts.fromDate);
  const candidates: CandidateSlot[] = [];

  for (let i = 0; i < opts.days; i++) {
    const day = addDays(rangeStart, i);
    const dateStr = format(day, "yyyy-MM-dd");
    const weekday = getDay(day);

    for (const rule of rules) {
      if (!rule.is_active || rule.day_of_week !== weekday) continue;

      let cursor = fromZonedTime(`${dateStr}T${rule.start_time}`, rule.timezone);
      const ruleEnd = fromZonedTime(`${dateStr}T${rule.end_time}`, rule.timezone);

      while (addMinutes(cursor, rule.slot_duration_minutes) <= ruleEnd) {
        const slotEnd = addMinutes(cursor, rule.slot_duration_minutes);
        if (!isBefore(cursor, now)) {
          candidates.push({
            start: cursor,
            end: slotEnd,
            ruleId: rule.id,
            needsApproval: isBefore(cursor, autoConfirmFrom),
          });
        }
        cursor = addMinutes(cursor, BOOKING_START_STEP_MINUTES);
      }
    }
  }

  return candidates.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Candidates from `now` through the next `days` days. Starts one calendar
 * day early because `now`'s date is read in the server's timezone (UTC on
 * Vercel): after 6 PM Mountain, UTC is already "tomorrow", and starting there
 * would silently drop the rest of today's evening windows. Past starts are
 * filtered out by generateCandidateSlots anyway.
 */
export function generateUpcomingSlots(
  rules: AvailabilityRule[],
  opts: { now: Date; days: number },
): CandidateSlot[] {
  return generateCandidateSlots(rules, {
    fromDate: format(addDays(opts.now, -1), "yyyy-MM-dd"),
    days: opts.days + 1,
    now: opts.now,
  });
}

export type OpenSlot = CandidateSlot;

/**
 * Drops any candidate that time-overlaps an already-booked individual
 * session. Candidates are generated every 15 minutes, so a booked 2:00-3:00
 * session must also block overlapping candidates like 1:45 or 2:15, not just
 * an exact 2:00 match.
 */
export function markOpenSlots(
  candidates: CandidateSlot[],
  existingSlots: SessionSlot[],
  activeBookingCountBySlotId: Record<string, number>,
): OpenSlot[] {
  const bookedRanges = existingSlots
    .filter(
      (s) =>
        s.status === "OPEN" && (activeBookingCountBySlotId[s.id] ?? 0) > 0,
    )
    .map((s) => ({
      start: new Date(s.start_time).getTime(),
      end: new Date(s.end_time).getTime(),
    }));

  return candidates.filter((candidate) => {
    const start = candidate.start.getTime();
    const end = candidate.end.getTime();
    return !bookedRanges.some((r) => start < r.end && end > r.start);
  });
}
