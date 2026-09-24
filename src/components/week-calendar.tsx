"use client";

import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export interface CandidateSlotDTO {
  start: string;
  end: string;
  bookable: boolean;
}

export interface BusySlotDTO {
  start: string;
  end: string;
  studentName?: string;
}

interface Cell {
  start: Date;
  end: Date;
  state: "open" | "cutoff" | "booked";
  label?: string;
}

export function WeekCalendar({
  role,
  candidates,
  busySlots,
  onBookSlot,
  isPending,
  busyKey,
}: {
  role: Role;
  candidates: CandidateSlotDTO[];
  busySlots: BusySlotDTO[];
  onBookSlot: (start: string, end: string) => void;
  isPending: boolean;
  busyKey: string | null;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(
    () => addDays(startOfWeek(today), weekOffset * 7),
    [today, weekOffset],
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const maxAvailableDate = useMemo(() => {
    const times = candidates.map((c) => new Date(c.start).getTime());
    return times.length ? new Date(Math.max(...times)) : today;
  }, [candidates, today]);

  const canGoNext = addDays(weekStart, 7) <= maxAvailableDate;

  const cellsByDay = useMemo(() => {
    const map = new Map<string, Cell[]>();
    for (const day of days) map.set(format(day, "yyyy-MM-dd"), []);

    const busy = busySlots.map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
      studentName: b.studentName,
    }));

    for (const c of candidates) {
      const start = new Date(c.start);
      const key = format(start, "yyyy-MM-dd");
      const bucket = map.get(key);
      if (!bucket) continue;

      const end = new Date(c.end);
      const conflict = busy.find((b) => start.getTime() < b.end && end.getTime() > b.start);

      bucket.push(
        conflict
          ? { start, end, state: "booked", label: conflict.studentName }
          : { start, end, state: c.bookable ? "open" : "cutoff" },
      );
    }

    for (const bucket of map.values()) bucket.sort((a, b) => a.start.getTime() - b.start.getTime());
    return map;
  }, [days, candidates, busySlots]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={weekOffset === 0}
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
        >
          ← Prev
        </Button>
        <span className="text-sm font-medium">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
        </span>
        <Button variant="outline" size="sm" disabled={!canGoNext} onClick={() => setWeekOffset((w) => w + 1)}>
          Next →
        </Button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const cells = cellsByDay.get(key) ?? [];
          const isToday = isSameDay(day, today);

          return (
            <div key={key} className="w-32 shrink-0">
              <div
                className={cn(
                  "mb-2 rounded-md px-2 py-1 text-center text-xs font-medium",
                  isToday ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                <div>{format(day, "EEE")}</div>
                <div>{format(day, "MMM d")}</div>
              </div>
              <div className="flex flex-col gap-1">
                {cells.length === 0 && (
                  <p className="px-1 text-center text-xs text-muted-foreground">No availability</p>
                )}
                {cells.map((cell) => {
                  const clickable = cell.state === "open" || (role === "admin" && cell.state === "cutoff");
                  const key = cell.start.toISOString();
                  return (
                    <Button
                      key={key}
                      size="sm"
                      variant={
                        cell.state === "booked" ? "secondary" : cell.state === "open" ? "outline" : "ghost"
                      }
                      disabled={!clickable || (isPending && busyKey === key)}
                      onClick={() => clickable && onBookSlot(cell.start.toISOString(), cell.end.toISOString())}
                      title={
                        cell.state === "booked"
                          ? cell.label
                            ? `Booked — ${cell.label}`
                            : "Booked"
                          : cell.state === "cutoff"
                            ? "Sessions must be requested at least 72 hours in advance"
                            : undefined
                      }
                      className={cn(
                        "h-auto w-full justify-center py-1.5 text-xs",
                        cell.state === "booked" && "opacity-60",
                        cell.state === "cutoff" && role !== "admin" && "opacity-40",
                      )}
                    >
                      {format(cell.start, "h:mm a")}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border" /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-secondary opacity-60" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-muted opacity-40" /> Too soon to book (72h)
        </span>
      </div>
    </div>
  );
}
