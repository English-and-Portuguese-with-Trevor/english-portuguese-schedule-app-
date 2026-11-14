"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import {
  createAvailabilityRule,
  deleteAvailabilityRule,
  toggleAvailabilityRule,
} from "@/lib/actions/availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_NAMES, type AvailabilityRule } from "@/lib/types";

// Where Trevor and his students are; this device's zone and a rule's own
// zone are added when they're not here.
const COMMON_TIME_ZONES = [
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Manaus",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "UTC",
];

const noopSubscribe = () => () => {};
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// A weekly window as it reads in another zone: its day and times there, taken
// from its next occurrence (so the clocks' current offset, summer or winter).
function inZone(rule: AvailabilityRule, zone: string) {
  const now = new Date();
  const today = formatInTimeZone(now, rule.timezone, "yyyy-MM-dd");
  const daysAhead = (rule.day_of_week - Number(formatInTimeZone(now, rule.timezone, "i")) + 7) % 7;
  const date = new Date(Date.parse(`${today}T12:00:00Z`) + daysAhead * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const start = fromZonedTime(`${date}T${rule.start_time}`, rule.timezone);
  const end = fromZonedTime(`${date}T${rule.end_time}`, rule.timezone);
  return {
    day: Number(formatInTimeZone(start, zone, "i")) % 7,
    start: formatInTimeZone(start, zone, "HH:mm"),
    end: formatInTimeZone(end, zone, "HH:mm"),
    zone,
  };
}

export function AvailabilityManager({ initialRules }: { initialRules: AvailabilityRule[] }) {
  const router = useRouter();
  const [prevInitialRules, setPrevInitialRules] = useState(initialRules);
  const [rules, setRules] = useState(initialRules);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dayOfWeek: "1",
    startTime: "09:00",
    endTime: "17:00",
    slotDurationMinutes: "60",
    timezone: "America/Denver",
  });
  // "" shows each window as it was set, in its own zone.
  const [viewZone, setViewZone] = useState("");
  // Off: the common zones. On: every zone the browser knows.
  const [allZones, setAllZones] = useState(false);
  // A new window arrives through router.refresh() as new initialRules.
  if (initialRules !== prevInitialRules) {
    setPrevInitialRules(initialRules);
    setRules(initialRules);
  }

  // The server (UTC) doesn't know this device's zone, so it's added on the client only.
  const deviceZone = useSyncExternalStore(noopSubscribe, deviceTimeZone, () => null);
  const timeZones = Array.from(
    new Set([form.timezone, ...COMMON_TIME_ZONES, ...(deviceZone ? [deviceZone] : [])]),
  );

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createAvailabilityRule({
        dayOfWeek: Number(form.dayOfWeek),
        startTime: `${form.startTime}:00`,
        endTime: `${form.endTime}:00`,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        timezone: form.timezone,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleToggle(id: string, next: boolean) {
    setError(null);
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    startTransition(async () => {
      const result = await toggleAvailabilityRule(id, next);
      if (result.error) {
        setError(`Couldn't change the window: ${result.error}`);
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !next } : r)));
      }
    });
  }

  function handleDelete(id: string) {
    const removed = rules.find((r) => r.id === id);
    if (
      removed &&
      !window.confirm(
        `Delete the ${DAY_NAMES[removed.day_of_week]} window ${removed.start_time.slice(0, 5)}–${removed.end_time.slice(0, 5)}? This can't be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setRules((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      const result = await deleteAvailabilityRule(id);
      if (result.error) {
        setError(`Couldn't delete the window: ${result.error}`);
        if (removed) setRules((prev) => (prev.some((r) => r.id === id) ? prev : [...prev, removed]));
      }
    });
  }

  // Monday first, the way the week reads; Sunday last.
  const week = [1, 2, 3, 4, 5, 6, 0];
  const shown = rules
    .map((rule) => ({
      rule,
      view: viewZone
        ? inZone(rule, viewZone)
        : {
            day: rule.day_of_week,
            start: rule.start_time.slice(0, 5),
            end: rule.end_time.slice(0, 5),
            zone: rule.timezone,
          },
    }))
    .sort((a, b) => a.view.start.localeCompare(b.view.start));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Your weekly windows for 1:1 classes. Students see the open start times in them, minus
          existing bookings.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="view-timezone">Show times in</Label>
        <Select
          value={viewZone || "own"}
          onValueChange={(v) => setViewZone(v === "own" ? "" : v)}
        >
          <SelectTrigger id="view-timezone" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="own">My time (as set)</SelectItem>
            {(allZones
              ? Intl.supportedValuesOf("timeZone")
              : Array.from(new Set([...(viewZone ? [viewZone] : []), ...timeZones]))
            ).map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox checked={allZones} onCheckedChange={(v) => setAllZones(v === true)} />
          All time zones
        </Label>
      </div>

      <ul className="divide-y rounded-lg border">
        {week.map((day) => {
          const dayRules = shown.filter((r) => r.view.day === day);
          return (
            <li
              key={day}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-6"
            >
              <span className="w-28 shrink-0 text-sm font-medium sm:py-1.5">{DAY_NAMES[day]}</span>
              {dayRules.length === 0 ? (
                <span className="text-sm text-muted-foreground sm:py-1.5">No windows</span>
              ) : (
                <ul className="flex flex-1 flex-col gap-1">
                  {dayRules.map(({ rule, view }) => (
                    <li key={rule.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        className={
                          rule.is_active
                            ? "text-sm tabular-nums"
                            : "text-sm tabular-nums text-muted-foreground line-through"
                        }
                      >
                        {view.start}–{view.end}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {rule.slot_duration_minutes} min · {view.zone}
                      </span>
                      {!rule.is_active && <Badge variant="secondary">Off</Badge>}
                      <span className="ml-auto flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleToggle(rule.id, !rule.is_active)}
                        >
                          {rule.is_active ? "Turn off" : "Turn on"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={isPending}
                          onClick={() => handleDelete(rule.id)}
                        >
                          Delete
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <details className="group rounded-lg border" open={rules.length === 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Add a weekly window
          <ChevronDown
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="grid grid-cols-2 items-end gap-4 border-t px-4 py-4 sm:grid-cols-3 lg:grid-cols-[repeat(5,auto)_1fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-day">Day</Label>
            <Select value={form.dayOfWeek} onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}>
              <SelectTrigger id="rule-day" className="w-full lg:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {week.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {DAY_NAMES[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-start">Start</Label>
            <Input
              id="rule-start"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-end">End</Label>
            <Input
              id="rule-end"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-duration">Class length (min)</Label>
            <Input
              id="rule-duration"
              type="number"
              min={5}
              className="lg:w-24"
              value={form.slotDurationMinutes}
              onChange={(e) => setForm({ ...form, slotDurationMinutes: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <Label htmlFor="rule-timezone">Time zone</Label>
            <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
              <SelectTrigger id="rule-timezone" className="w-full lg:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="col-span-2 sm:col-span-1 lg:justify-self-start" onClick={handleCreate} disabled={isPending}>
            Add window
          </Button>
        </div>
      </details>
    </div>
  );
}
