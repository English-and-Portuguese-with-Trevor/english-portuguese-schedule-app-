"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { useMemo } from "react";

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

type CellState = "open" | "cutoff" | "booked" | "closed";

interface Cell {
  state: CellState;
  start?: Date;
  end?: Date;
  label?: string;
}

const ROW_MINUTES = 15;

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
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
  const today = useMemo(() => startOfDay(new Date()), []);
  // Start from today rather than the calendar week's Sunday — already-passed
  // days are never bookable, so showing them first would just waste the view.
  const weekStart = today;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekCandidates = useMemo(
    () => candidates.filter((c) => days.some((d) => isSameDay(d, new Date(c.start)))),
    [candidates, days],
  );

  const { startMinutes, endMinutes } = useMemo(() => {
    if (weekCandidates.length === 0) return { startMinutes: 9 * 60, endMinutes: 17 * 60 };
    let min = Infinity;
    let max = -Infinity;
    for (const c of weekCandidates) {
      const start = minutesOfDay(new Date(c.start));
      const end = minutesOfDay(new Date(c.end));
      min = Math.min(min, start);
      max = Math.max(max, end);
    }
    return {
      startMinutes: Math.floor(min / 60) * 60,
      endMinutes: Math.ceil(max / 60) * 60,
    };
  }, [weekCandidates]);

  const rowCount = Math.max(1, Math.round((endMinutes - startMinutes) / ROW_MINUTES));
  const rowMinutesList = useMemo(
    () => Array.from({ length: rowCount }, (_, i) => startMinutes + i * ROW_MINUTES),
    [rowCount, startMinutes],
  );

  const busy = useMemo(
    () =>
      busySlots.map((b) => ({
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime(),
        studentName: b.studentName,
      })),
    [busySlots],
  );

  const cellsByDay = useMemo(() => {
    const map = new Map<string, Map<number, Cell>>();
    for (const day of days) map.set(format(day, "yyyy-MM-dd"), new Map());

    for (const c of weekCandidates) {
      const start = new Date(c.start);
      const end = new Date(c.end);
      const dayKey = format(start, "yyyy-MM-dd");
      const bucket = map.get(dayKey);
      if (!bucket) continue;

      const conflict = busy.find((b) => start.getTime() < b.end && end.getTime() > b.start);
      bucket.set(
        minutesOfDay(start),
        conflict
          ? { state: "booked", start, end, label: conflict.studentName }
          : { state: c.bookable ? "open" : "cutoff", start, end },
      );
    }

    return map;
  }, [days, weekCandidates, busy]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
      </p>

      <div className="overflow-x-auto rounded-md border">
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          {/* Header row */}
          <div className="border-b border-r bg-muted/40" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-b border-r px-1 py-1.5 text-center text-xs font-medium last:border-r-0",
                isSameDay(day, today) ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground",
              )}
            >
              <div>{format(day, "EEE")}</div>
              <div>{format(day, "MMM d")}</div>
            </div>
          ))}

          {/* Time rows */}
          {rowMinutesList.map((minutes) => {
            const isHourStart = minutes % 60 === 0;
            const hourLabel =
              isHourStart &&
              format(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60), "h a");

            return (
              <div key={minutes} className="contents">
                <div
                  className={cn(
                    "border-r px-1 text-right text-[10px] leading-none text-muted-foreground",
                    isHourStart ? "border-t pt-0.5" : "",
                  )}
                >
                  {hourLabel || ""}
                </div>
                {days.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const cell = cellsByDay.get(dayKey)?.get(minutes) ?? { state: "closed" as const };
                  const clickable = cell.state === "open" || (role === "admin" && cell.state === "cutoff");
                  const cellKey = cell.start?.toISOString() ?? `${dayKey}-${minutes}`;

                  return (
                    <button
                      key={cellKey}
                      type="button"
                      disabled={!clickable || (isPending && busyKey === cell.start?.toISOString())}
                      onClick={() =>
                        clickable && cell.start && cell.end && onBookSlot(cell.start.toISOString(), cell.end.toISOString())
                      }
                      title={
                        cell.state === "booked"
                          ? cell.label
                            ? `Booked — ${cell.label}`
                            : "Booked"
                          : cell.state === "cutoff"
                            ? "Sessions must be requested at least 72 hours in advance"
                            : cell.state === "open"
                              ? cell.start && format(cell.start, "h:mm a")
                              : undefined
                      }
                      className={cn(
                        "flex h-6 items-center justify-center border-r border-t px-0.5 text-[9px] font-medium leading-none transition-colors last:border-r-0",
                        isHourStart && "border-t-2 border-t-border",
                        cell.state === "closed" && "bg-muted/20",
                        cell.state === "open" &&
                          "cursor-pointer bg-primary/15 text-foreground hover:bg-primary/30",
                        cell.state === "cutoff" &&
                          (role === "admin"
                            ? "cursor-pointer bg-primary/10 text-foreground hover:bg-primary/25"
                            : "cursor-not-allowed bg-muted/50 text-muted-foreground"),
                        cell.state === "booked" && "cursor-not-allowed bg-secondary text-secondary-foreground",
                      )}
                    >
                      {cell.state !== "closed" && cell.start ? format(cell.start, "h:mm") : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary/15" /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-secondary" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-muted/50" /> Too soon to book (72h)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-muted/20" /> No availability
        </span>
      </div>
    </div>
  );
}
