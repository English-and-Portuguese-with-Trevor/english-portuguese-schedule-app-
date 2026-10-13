"use client";

import { format, isSameMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminBookStudent } from "@/lib/actions/bookings";
import { toggleAvailabilityRule } from "@/lib/actions/availability";
import {
  BookingItem,
  ManualBookingForm,
  useAdminBookings,
  useDeviceTime,
  type AdminBookingRow,
  type Student,
} from "@/components/admin/booking-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  assignLanes,
  availabilityWindows,
  clipToDay,
  dayKey,
  hourRange,
  minutesIntoDay,
  parseDateParam,
  shiftAnchor,
  visibleDays,
  type CalendarView,
  type Window,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { DAY_NAMES, type AvailabilityRule } from "@/lib/types";

/** `notes` carries e.g. "Hold: Tim", a time held on Trevor's own account for a student with no account yet; it shows under the name. */
export type CalendarBooking = AdminBookingRow & { late_cancellation: boolean; notes?: string | null };

/** A booking placed on the calendar, with its times as dates. */
interface Entry {
  booking: CalendarBooking;
  start: Date;
  end: Date;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_PX = 48;
/** Labels a month cell shows before "+N more". */
const MONTH_CELL_LIMIT = 3;

/** "9a", "9:30a", "12p": compact times for the grid. */
function shortTime(date: Date) {
  return format(date, date.getMinutes() ? "h:mmaaaaa" : "haaaaa");
}

const longTime = (date: Date) => format(date, "h:mm a");

/** The colors of a booking by status: amber waits for approval, green is confirmed, canceled is struck through. */
function statusClasses(b: CalendarBooking) {
  if (b.status === "PENDING")
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100";
  if (b.status === "CONFIRMED")
    return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  return "border-transparent bg-transparent text-muted-foreground line-through";
}

function dotClass(b: CalendarBooking) {
  if (b.status === "PENDING") return "bg-amber-500";
  if (b.status === "CONFIRMED") return "bg-emerald-600 dark:bg-emerald-400";
  return "bg-muted-foreground/40";
}

function LateMark() {
  return (
    <span className="ml-1 inline-block rounded-sm bg-destructive/15 px-1 text-[10px] font-semibold text-destructive">
      late
    </span>
  );
}

export function AdminCalendar({
  view,
  date,
  initialBookings,
  originalStarts,
  rules,
  students,
  displayNames,
}: {
  view: CalendarView;
  /** The `?date=` shown (yyyy-MM-dd), or null for today. */
  date: string | null;
  initialBookings: CalendarBooking[];
  /** Start of the class each reschedule request would move; null if it was canceled. */
  originalStarts: Record<string, string | null>;
  rules: AvailabilityRule[];
  students: Student[];
  displayNames: Record<string, string>;
}) {
  const router = useRouter();
  const { isClient, tzLabel } = useDeviceTime();
  const { bookings, confirm, cancel, error, setError, isPending, startTransition } = useAdminBookings(
    initialBookings,
    "admin-calendar-live",
  );
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Everything is placed in this device's time zone, so it's drawn on the client only.
  if (!isClient) return <div className="min-h-[70svh]" />;

  const anchor = parseDateParam(date ?? undefined) ?? new Date();
  const days = visibleDays(view, anchor);
  const windows = availabilityWindows(rules, days);
  const entries: Entry[] = bookings
    .filter((b) => b.session_slots)
    .map((b) => ({ booking: b, start: new Date(b.session_slots!.start_time), end: new Date(b.session_slots!.end_time) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const entriesOn = (day: Date) => clipToDay(entries, day);
  const windowsOn = (day: Date) => clipToDay(windows, day);
  const nameOf = (b: CalendarBooking) => displayNames[b.student_id] ?? "Unknown";

  const href = (v: CalendarView, d?: Date) => `?view=${v}${d ? `&date=${dayKey(d)}` : ""}`;
  const title =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : `${format(days[0], "MMM d")} – ${format(days[6], isSameMonth(days[0], days[6]) ? "d, yyyy" : "MMM d, yyyy")}`;

  function handleBook(studentId: string, startIso: string, endIso: string) {
    setError(null);
    startTransition(async () => {
      const result = await adminBookStudent(studentId, startIso, endIso);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleWindowOff(rule: AvailabilityRule) {
    setError(null);
    startTransition(async () => {
      const result = await toggleAvailabilityRule(rule.id, false);
      if (result.error) {
        setError(`Couldn't change the window: ${result.error}`);
        return;
      }
      router.refresh();
    });
  }

  const selected = openDay ? parseDateParam(openDay) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Every class and your open hours. Click a day to approve, cancel or book.
        </p>
        {tzLabel && <p className="text-xs text-muted-foreground">Times shown in {tzLabel}.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="w-full text-lg font-semibold sm:order-2 sm:mr-auto sm:w-auto">{title}</h2>
        <div className="flex items-center gap-2 sm:order-1">
          <Button asChild variant="outline" size="icon" aria-label={view === "month" ? "Previous month" : "Previous week"}>
            <Link href={href(view, shiftAnchor(view, anchor, -1))}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={href(view)}>Today</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label={view === "month" ? "Next month" : "Next week"}>
            <Link href={href(view, shiftAnchor(view, anchor, 1))}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div role="group" aria-label="View" className="inline-flex rounded-md border p-0.5 sm:order-3">
          {(["month", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href(v, date ? anchor : undefined)}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "rounded-[5px] px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground",
                v === view && "bg-accent text-accent-foreground",
              )}
            >
              {v === "month" ? "Month" : "Week"}
            </Link>
          ))}
        </div>
      </div>

      <Legend />

      {error && !openDay && <p className="text-sm text-destructive">{error}</p>}

      {view === "month" ? (
        <MonthGrid
          days={days}
          anchor={anchor}
          entriesOn={entriesOn}
          windowsOn={windowsOn}
          nameOf={nameOf}
          onOpen={setOpenDay}
        />
      ) : (
        <WeekGrid
          days={days}
          entries={entries}
          windows={windows}
          entriesOn={entriesOn}
          windowsOn={windowsOn}
          nameOf={nameOf}
          onOpen={setOpenDay}
        />
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setOpenDay(null)}>
        {selected && (
          <DayPanel
            day={selected}
            entries={entriesOn(selected)}
            windows={windowsOn(selected)}
            originalStarts={originalStarts}
            nameOf={nameOf}
            students={students}
            tzLabel={tzLabel}
            error={error}
            isPending={isPending}
            onConfirm={confirm}
            onCancel={cancel}
            onBook={handleBook}
            onWindowOff={handleWindowOff}
          />
        )}
      </Dialog>
    </div>
  );
}

function Legend() {
  const item = "flex items-center gap-1.5";
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className={item}>
        <span className="size-2.5 rounded-full bg-amber-500" /> Waiting for approval
      </li>
      <li className={item}>
        <span className="size-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" /> Confirmed
      </li>
      <li className={item}>
        <span className="line-through">Canceled</span>
        <LateMark />
        <span>late cancellation</span>
      </li>
      <li className={item}>
        <span className="h-2.5 w-4 rounded-sm bg-brand/15" /> Open hours
      </li>
    </ul>
  );
}

function MonthGrid({
  days,
  anchor,
  entriesOn,
  windowsOn,
  nameOf,
  onOpen,
}: {
  days: Date[];
  anchor: Date;
  entriesOn: (day: Date) => Entry[];
  windowsOn: (day: Date) => Window[];
  nameOf: (b: CalendarBooking) => string;
  onOpen: (key: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEntries = entriesOn(day);
          const dayWindows = windowsOn(day);
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);
          const extra = dayEntries.length - MONTH_CELL_LIMIT;
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onOpen(dayKey(day))}
              aria-label={`${format(day, "EEEE, MMMM d")}: ${dayEntries.length} ${dayEntries.length === 1 ? "class" : "classes"}`}
              className={cn(
                "flex min-h-16 flex-col items-stretch gap-1 p-1 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-28 sm:p-1.5",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !inMonth && "bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center self-center rounded-full text-xs font-medium sm:self-start",
                  !inMonth && "text-muted-foreground",
                  today && "bg-brand font-semibold text-white dark:text-black",
                )}
              >
                {format(day, "d")}
              </span>

              {/* Wide screens: a label per class. */}
              <span className="hidden flex-col gap-0.5 sm:flex">
                {dayEntries.slice(0, MONTH_CELL_LIMIT).map(({ booking: b, start }) => (
                  <span
                    key={b.id}
                    className={cn("truncate rounded border px-1 py-px text-[11px] leading-4", statusClasses(b))}
                  >
                    <span className="font-medium tabular-nums">{shortTime(start)}</span> {nameOf(b)}
                    {b.notes && <span className="opacity-80"> · {b.notes}</span>}
                    {b.late_cancellation && <LateMark />}
                  </span>
                ))}
                {extra > 0 && <span className="px-1 text-[11px] text-muted-foreground">+{extra} more</span>}
              </span>

              {/* Phones: a dot per class. */}
              <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {dayEntries.slice(0, 6).map(({ booking: b }) => (
                  <span key={b.id} className={cn("size-1.5 rounded-full", dotClass(b))} />
                ))}
              </span>

              {dayWindows.length > 0 && (
                <span className="mt-auto">
                  <span className="block h-1 rounded-full bg-brand/15 sm:hidden" />
                  <span className="hidden truncate rounded-sm bg-brand/[0.07] px-1 text-[10px] leading-4 text-muted-foreground sm:block">
                    Open {dayWindows.map((w) => `${shortTime(w.start)}–${shortTime(w.end)}`).join(", ")}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  entries,
  windows,
  entriesOn,
  windowsOn,
  nameOf,
  onOpen,
}: {
  days: Date[];
  entries: Entry[];
  windows: Window[];
  entriesOn: (day: Date) => Entry[];
  windowsOn: (day: Date) => Window[];
  nameOf: (b: CalendarBooking) => string;
  onOpen: (key: string) => void;
}) {
  const { first, last } = hourRange([...entries, ...windows], days);
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (date: Date, day: Date) => ((minutesIntoDay(date, day) - first * 60) / 60) * HOUR_PX;

  return (
    <>
      {/* Wide screens: columns on a time axis. */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b bg-muted/50">
          <div />
          {days.map((day) => (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onOpen(dayKey(day))}
              className="flex items-center justify-center gap-1.5 border-l py-2 text-xs font-medium text-muted-foreground hover:bg-accent/60"
            >
              {format(day, "EEE")}
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-sm text-foreground",
                  isToday(day) && "bg-brand font-semibold text-white dark:text-black",
                )}
              >
                {format(day, "d")}
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
                style={{ top: i * HOUR_PX }}
              >
                {i > 0 && format(new Date(2000, 0, 1, h), "h a")}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={dayKey(day)}
              role="button"
              tabIndex={0}
              aria-label={format(day, "EEEE, MMMM d")}
              onClick={() => onOpen(dayKey(day))}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(dayKey(day))}
              className={cn(
                "relative cursor-pointer border-l outline-none hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isToday(day) && "bg-brand/[0.03]",
              )}
              style={{ height: hours.length * HOUR_PX }}
            >
              {hours.map((h, i) =>
                i > 0 ? <div key={h} className="absolute inset-x-0 border-t border-dashed" style={{ top: i * HOUR_PX }} /> : null,
              )}
              {windowsOn(day).map((w) => (
                <div
                  key={`${w.rule.id}-${w.start.getTime()}`}
                  className="absolute inset-x-0 bg-brand/10"
                  style={{ top: top(w.start, day), height: top(w.end, day) - top(w.start, day) }}
                />
              ))}
              {assignLanes(entriesOn(day)).map(({ booking: b, start, end, lane, lanes }) => (
                <div
                  key={b.id}
                  className={cn(
                    "absolute overflow-hidden rounded border px-1 py-0.5 text-[11px] leading-4 shadow-xs",
                    statusClasses(b),
                    b.status === "CANCELLED" && "border-dashed border-border bg-background/80",
                  )}
                  style={{
                    top: top(start, day) + 1,
                    height: Math.max(top(end, day) - top(start, day) - 2, 18),
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                  }}
                >
                  <span className="block font-medium tabular-nums">
                    {shortTime(start)}–{shortTime(end)}
                    {b.late_cancellation && <LateMark />}
                  </span>
                  <span className="block truncate">{nameOf(b)}</span>
                  {b.notes && <span className="block truncate text-[10px] opacity-80">{b.notes}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Phones: the week as a list of days. */}
      <ul className="flex flex-col divide-y rounded-lg border md:hidden">
        {days.map((day) => {
          const dayEntries = entriesOn(day);
          const dayWindows = windowsOn(day);
          return (
            <li key={dayKey(day)}>
              <button
                type="button"
                onClick={() => onOpen(dayKey(day))}
                className="flex w-full gap-3 px-3 py-3 text-left hover:bg-accent/60"
              >
                <span className="flex w-10 shrink-0 flex-col items-center">
                  <span className="text-xs text-muted-foreground">{format(day, "EEE")}</span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-medium",
                      isToday(day) && "bg-brand font-semibold text-white dark:text-black",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  {dayEntries.length === 0 && <span className="text-sm text-muted-foreground">No classes</span>}
                  {dayEntries.map(({ booking: b, start, end }) => (
                    <span key={b.id} className={cn("truncate rounded border px-2 py-1 text-sm", statusClasses(b))}>
                      <span className="font-medium tabular-nums">
                        {shortTime(start)}–{shortTime(end)}
                      </span>{" "}
                      {nameOf(b)}
                      {b.notes && <span className="opacity-80"> · {b.notes}</span>}
                      {b.late_cancellation && <LateMark />}
                    </span>
                  ))}
                  {dayWindows.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Open {dayWindows.map((w) => `${shortTime(w.start)}–${shortTime(w.end)}`).join(", ")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DayPanel({
  day,
  entries,
  windows,
  originalStarts,
  nameOf,
  students,
  tzLabel,
  error,
  isPending,
  onConfirm,
  onCancel,
  onBook,
  onWindowOff,
}: {
  day: Date;
  entries: Entry[];
  windows: Window[];
  originalStarts: Record<string, string | null>;
  nameOf: (b: CalendarBooking) => string;
  students: Student[];
  tzLabel: string | null;
  error: string | null;
  isPending: boolean;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onBook: (studentId: string, startIso: string, endIso: string) => void;
  onWindowOff: (rule: AvailabilityRule) => void;
}) {
  const now = new Date();
  const isPast = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1) <= now;

  return (
    <DialogContent className="top-auto bottom-0 left-0 max-h-[90svh] max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-t-xl sm:top-0 sm:right-0 sm:left-auto sm:h-svh sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0">
      <DialogHeader className="text-left">
        <DialogTitle>{format(day, "EEEE, MMMM d")}</DialogTitle>
        <DialogDescription>{tzLabel ? `Times shown in ${tzLabel}.` : "Times shown in this device's time zone."}</DialogDescription>
      </DialogHeader>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Classes ({entries.length})</h3>
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No classes this day.</p>}
        {entries.map(({ booking: b, start, end }) => {
          const when = `${longTime(start)} – ${longTime(end)}`;
          // Upcoming pending and confirmed classes keep the Bookings page's actions.
          if (b.status !== "CANCELLED" && end > now) {
            return (
              <BookingItem
                key={b.id}
                booking={b}
                name={nameOf(b)}
                when={when}
                originalStart={b.reschedule_of ? (originalStarts[b.reschedule_of] ?? null) : null}
                onConfirm={onConfirm}
                onCancel={onCancel}
              />
            );
          }
          const status =
            b.status === "CANCELLED"
              ? b.late_cancellation
                ? "Late cancellation (counts as a class)"
                : "Canceled"
              : b.status === "PENDING"
                ? "Request not answered"
                : "Done";
          return (
            <div key={b.id} className="rounded-md border px-4 py-3">
              <p className={cn("text-sm font-medium", b.status === "CANCELLED" && "text-muted-foreground line-through")}>
                {nameOf(b)}
                {b.notes && <span className="font-normal text-muted-foreground"> · {b.notes}</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {when} · <span className={cn(b.late_cancellation && "text-destructive")}>{status}</span>
              </p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Open hours</h3>
        {windows.length === 0 && <p className="text-sm text-muted-foreground">No open hours this day.</p>}
        {windows.map((w) => (
          <div key={`${w.rule.id}-${w.start.getTime()}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border bg-brand/5 px-4 py-2">
            <div>
              <p className="text-sm tabular-nums">
                {longTime(w.start)} – {longTime(w.end)}
              </p>
              <p className="text-xs text-muted-foreground">
                Every {DAY_NAMES[w.rule.day_of_week]} · {w.rule.slot_duration_minutes} min classes
              </p>
            </div>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => onWindowOff(w.rule)}>
              Turn off every {DAY_NAMES[w.rule.day_of_week]}
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Weekly hours are set on the{" "}
          <Link href="/admin/availability" className="underline underline-offset-4">
            Availability
          </Link>{" "}
          page.
        </p>
      </section>

      {!isPast && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Book a student</h3>
          <p className="text-xs text-muted-foreground">Confirmed right away; the student gets the invitation.</p>
          <div className="flex flex-wrap items-end gap-4">
            <ManualBookingForm
              key={dayKey(day)}
              students={students}
              defaultDate={dayKey(day)}
              disabled={isPending}
              onBook={onBook}
              idPrefix="calendar-book"
            />
          </div>
        </section>
      )}
    </DialogContent>
  );
}
