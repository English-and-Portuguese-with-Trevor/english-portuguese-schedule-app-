import { addDays, addMinutes, format, getDay, isBefore, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import { BOOKING_CUTOFF_HOURS, type AvailabilityRule, type SessionSlot } from "@/lib/types";

export interface CandidateSlot {
  start: Date;
  end: Date;
  ruleId: string;
  /** false if the slot starts within the 72h student booking cutoff */
  bookable: boolean;
}

/**
 * Expands an admin's recurring weekly availability windows into concrete
 * candidate start/end instants over a date range. Does not know about
 * existing bookings yet — see `markOpenSlots`.
 */
export function generateCandidateSlots(
  rules: AvailabilityRule[],
  opts: { fromDate: string; days: number; now?: Date },
): CandidateSlot[] {
  const now = opts.now ?? new Date();
  const cutoffInstant = addMinutes(now, BOOKING_CUTOFF_HOURS * 60);
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
            bookable: !isBefore(cursor, cutoffInstant),
          });
        }
        cursor = slotEnd;
      }
    }
  }

  return candidates.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface OpenSlot extends CandidateSlot {
  /** Set once a student (or admin) has actually reserved this start time */
  existingSlotId: string | null;
}

/**
 * Cross-references candidate slots against already-materialized SessionSlot
 * rows + their active booking counts, dropping any that are full.
 */
export function markOpenSlots(
  candidates: CandidateSlot[],
  existingSlots: SessionSlot[],
  activeBookingCountBySlotId: Record<string, number>,
): OpenSlot[] {
  const byStart = new Map(
    existingSlots
      .filter((s) => s.type === "INDIVIDUAL" && s.status === "OPEN")
      .map((s) => [new Date(s.start_time).getTime(), s]),
  );

  const openSlots: OpenSlot[] = [];

  for (const candidate of candidates) {
    const existing = byStart.get(candidate.start.getTime());
    const bookedCount = existing ? (activeBookingCountBySlotId[existing.id] ?? 0) : 0;
    const isFull = existing ? bookedCount >= existing.max_capacity : false;

    if (isFull) continue;

    openSlots.push({ ...candidate, existingSlotId: existing?.id ?? null });
  }

  return openSlots;
}
