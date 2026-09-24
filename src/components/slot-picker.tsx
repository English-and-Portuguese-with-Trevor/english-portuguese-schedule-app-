"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export interface CandidateSlotDTO {
  start: string;
  end: string;
  needsApproval: boolean;
}

export interface BusySlotDTO {
  start: string;
  end: string;
  studentName?: string;
}

const DAYS_SHOWN = 14;
const STEP_MS = 15 * 60 * 1000;

interface DaySlot {
  start: Date;
  end: Date;
  /** Overlaps an existing booking. */
  blocked: boolean;
  needsApproval: boolean;
}

interface Busy {
  start: Date;
  end: Date;
  studentName?: string;
}

interface DayInfo {
  blocks: DaySlot[][];
  busy: Busy[];
  selectableCount: number;
}

function timeZoneLabel() {
  return (
    new Intl.DateTimeFormat(undefined, { timeZoneName: "long" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "your local time"
  );
}

export function SlotPicker({
  role,
  candidates,
  busySlots,
  onBook,
}: {
  role: Role;
  candidates: CandidateSlotDTO[];
  busySlots: BusySlotDTO[];
  /** Resolves to an error message, or null on success. */
  onBook: (start: string, end: string) => Promise<string | null>;
}) {
  const isAdmin = role === "admin";
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)), [today]);

  const byDay = useMemo(() => {
    const busy: Busy[] = busySlots.map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
      studentName: b.studentName,
    }));

    const map = new Map<string, DayInfo>();
    for (const day of days) {
      const slots: DaySlot[] = candidates
        .filter((c) => isSameDay(new Date(c.start), day))
        .map((c) => {
          const start = new Date(c.start);
          const end = new Date(c.end);
          const blocked = busy.some((b) => start < b.end && end > b.start);
          return { start, end, blocked, needsApproval: c.needsApproval };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // Consecutive 15-minute starts belong to the same availability window.
      const blocks: DaySlot[][] = [];
      for (const slot of slots) {
        const current = blocks[blocks.length - 1];
        const prev = current?.[current.length - 1];
        if (prev && slot.start.getTime() - prev.start.getTime() === STEP_MS) current.push(slot);
        else blocks.push([slot]);
      }

      map.set(format(day, "yyyy-MM-dd"), {
        blocks,
        busy: busy.filter((b) => isSameDay(b.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime()),
        selectableCount: slots.filter((s) => !s.blocked).length,
      });
    }
    return map;
  }, [candidates, busySlots, days]);

  const firstDayWithOpenings = days.find((d) => (byDay.get(format(d, "yyyy-MM-dd"))?.selectableCount ?? 0) > 0);
  const [selectedKey, setSelectedKey] = useState(() => format(firstDayWithOpenings ?? today, "yyyy-MM-dd"));
  const selectedDay = days.find((d) => format(d, "yyyy-MM-dd") === selectedKey) ?? today;
  const info = byDay.get(selectedKey);

  const [pendingSlot, setPendingSlot] = useState<DaySlot | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tzLabel = useMemo(() => timeZoneLabel(), []);

  function confirm() {
    if (!pendingSlot) return;
    setDialogError(null);
    startTransition(async () => {
      const error = await onBook(pendingSlot.start.toISOString(), pendingSlot.end.toISOString());
      if (error) setDialogError(error);
      else setPendingSlot(null);
    });
  }

  // Admin bookings are always confirmed, so only students see the approval marker.
  const showsApproval = (slot: DaySlot) => !isAdmin && slot.needsApproval && !slot.blocked;
  const hasApprovalSlots = info?.blocks.some((b) => b.some(showsApproval)) ?? false;
  const pendingNeedsApproval = pendingSlot !== null && !isAdmin && pendingSlot.needsApproval;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Times shown in {tzLabel}.</p>

      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const count = byDay.get(key)?.selectableCount ?? 0;
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={`${format(day, "EEEE, MMMM d")}, ${count > 0 ? `${count} open` : "no availability"}`}
              onClick={() => setSelectedKey(key)}
              className={cn(
                "flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors",
                selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                !selected && count === 0 && "opacity-50",
              )}
            >
              <span className="text-[11px] font-medium uppercase">{format(day, "EEE")}</span>
              <span className="text-lg font-semibold leading-none">{format(day, "d")}</span>
              <span className={cn("text-[10px]", selected ? "opacity-80" : "text-muted-foreground")}>
                {count > 0 ? `${count} open` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h3>

        {info && info.busy.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1">
            {info.busy.map((b) => (
              <li
                key={b.start.toISOString()}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
              >
                {format(b.start, "h:mm")} – {format(b.end, "h:mm a")} · Booked
                {isAdmin && b.studentName ? ` (${b.studentName})` : ""}
              </li>
            ))}
          </ul>
        )}

        {!info || info.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No availability on this day.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {info.blocks.map((block) => (
              <div key={block[0].start.toISOString()}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {format(block[0].start, "h:mm a")} – {format(block[block.length - 1].end, "h:mm a")}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {block.map((slot) => (
                    <Button
                      key={slot.start.toISOString()}
                      variant="outline"
                      size="sm"
                      disabled={slot.blocked}
                      aria-label={
                        showsApproval(slot) ? `${format(slot.start, "h:mm a")}, needs approval` : undefined
                      }
                      onClick={() => {
                        setDialogError(null);
                        setPendingSlot(slot);
                      }}
                      className={cn(slot.blocked && "line-through", showsApproval(slot) && "border-dashed border-muted-foreground/60")}
                    >
                      {format(slot.start, "h:mm a")}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {hasApprovalSlots && (
              <p className="text-xs text-muted-foreground">
                Dashed times are less than 72 hours away. You can still request them, but Trevor needs
                to approve them first.
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={pendingSlot !== null} onOpenChange={(open) => !open && !isPending && setPendingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingNeedsApproval ? "Request this session?" : "Book this session?"}</DialogTitle>
            <DialogDescription>
              {pendingSlot &&
                `${format(pendingSlot.start, "EEEE, MMMM d")} · ${format(pendingSlot.start, "h:mm")} – ${format(
                  pendingSlot.end,
                  "h:mm a",
                )} (${tzLabel})`}
            </DialogDescription>
          </DialogHeader>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              {pendingNeedsApproval
                ? "It's less than 72 hours away, so it stays pending until Trevor approves it."
                : "It's confirmed as soon as you book."}
            </p>
          )}
          {dialogError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dialogError}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => setPendingSlot(null)}>
              Back
            </Button>
            <Button disabled={isPending} onClick={confirm}>
              {isPending ? "Sending…" : pendingNeedsApproval ? "Request" : "Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
