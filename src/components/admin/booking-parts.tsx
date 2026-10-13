"use client";

import { differenceInMinutes, format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

import { cancelBooking, confirmBooking } from "@/lib/actions/bookings";
import { timeZoneLabel } from "@/components/slot-picker";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LATE_CANCEL_HOURS } from "@/lib/types";

/** Shared by the admin Bookings and Calendar pages. */
export interface AdminBookingRow {
  id: string;
  student_id: string;
  status: string;
  is_admin_override: boolean;
  meet_link: string | null;
  reschedule_of: string | null;
  lesson_language: string | null;
  whatsapp: string | null;
  session_slots: {
    start_time: string;
    end_time: string;
  } | null;
}

export interface Student {
  id: string;
  name: string;
}

const noopSubscribe = () => () => {};

/**
 * Times on the admin pages follow this device's time zone, which the server
 * (UTC) can't know, so they're rendered on the client only. `tzLabel` says
 * which zone that is.
 */
export function useDeviceTime() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const tzLabel = useSyncExternalStore(noopSubscribe, timeZoneLabel, () => null);

  function formatStart(iso: string) {
    return isClient ? format(new Date(iso), "EEE, MMM d 'at' h:mm a") : null;
  }

  /** "starts in 3 h" while the class is less than a day away, so a late reschedule stands out. */
  function startsSoon(iso: string) {
    if (!isClient) return null;
    const minutes = differenceInMinutes(new Date(iso), new Date());
    if (minutes < 0 || minutes >= LATE_CANCEL_HOURS * 60) return null;
    return minutes < 60 ? `starts in ${minutes} min` : `starts in ${Math.floor(minutes / 60)} h`;
  }

  return { isClient, tzLabel, formatStart, startsSoon };
}

/**
 * The admin's bookings with approve and cancel, updated right away and put
 * back if the server refuses. Any change to bookings (here, by a student or
 * in another tab) reloads the page's data. Only the existing server actions
 * are used, so every change sends the usual student and admin emails.
 */
export function useAdminBookings<T extends AdminBookingRow>(initialBookings: T[], channelName: string) {
  const router = useRouter();
  const [prevInitialBookings, setPrevInitialBookings] = useState(initialBookings);
  const [bookings, setBookings] = useState(initialBookings);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (initialBookings !== prevInitialBookings) {
    setPrevInitialBookings(initialBookings);
    setBookings(initialBookings);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, channelName]);

  function setStatus(id: string, status: string) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  function confirm(id: string) {
    setError(null);
    setStatus(id, "CONFIRMED");
    startTransition(async () => {
      const result = await confirmBooking(id);
      if (result.error) {
        setError(`Couldn't confirm the booking: ${result.error}`);
        setStatus(id, "PENDING");
      }
    });
  }

  function cancel(id: string) {
    const before = bookings.find((b) => b.id === id)?.status;
    setError(null);
    setStatus(id, "CANCELLED");
    startTransition(async () => {
      const result = await cancelBooking(id);
      if (result.error) {
        setError(`Couldn't cancel the booking: ${result.error}`);
        if (before) setStatus(id, before);
      }
    });
  }

  return { bookings, confirm, cancel, error, setError, isPending, startTransition };
}

/**
 * One pending or confirmed booking: the student, the time, the booking
 * answers, and Confirm/Decline or Cancel. `originalStart` is the start of the
 * class a reschedule request would move (null if that class was canceled).
 */
export function BookingItem({
  booking: b,
  name,
  originalStart,
  onConfirm,
  onCancel,
  when,
}: {
  booking: AdminBookingRow;
  name: string;
  originalStart: string | null;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  /** Overrides the start date and time line (the calendar shows just the time). */
  when?: string | null;
}) {
  const { formatStart, startsSoon } = useDeviceTime();
  const start = when !== undefined ? when : b.session_slots && formatStart(b.session_slots.start_time);

  if (b.status === "PENDING") {
    // A reschedule request: the class it would move, and whether that's less than a day away.
    const soon = originalStart ? startsSoon(originalStart) : null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{start}</p>
          {b.reschedule_of && (
            <p className="text-sm font-medium text-brand">
              Reschedule
              {originalStart
                ? ` from ${formatStart(originalStart)}`
                : " (the original lesson was canceled; approving books this time as a new lesson)"}
              {soon && <span className="text-destructive"> · {soon}</span>}
            </p>
          )}
          <BookingAnswersLine language={b.lesson_language} whatsapp={b.whatsapp} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onConfirm(b.id)}>
            {b.reschedule_of ? "Approve move" : "Confirm"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.confirm(`Decline ${name}'s request for ${start}?`) && onCancel(b.id)}
          >
            Decline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{start}</p>
        <BookingAnswersLine language={b.lesson_language} whatsapp={b.whatsapp} />
      </div>
      <div className="flex items-center gap-2">
        {b.meet_link && (
          <a
            href={b.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline underline-offset-4"
          >
            Meet
          </a>
        )}
        {b.is_admin_override && <Badge variant="secondary">Override</Badge>}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.confirm(`Cancel ${name}'s class on ${start}? This can't be undone.`) && onCancel(b.id)
          }
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The student's booking answers: lesson language and a tap-to-chat WhatsApp link. */
export function BookingAnswersLine({ language, whatsapp }: { language: string | null; whatsapp: string | null }) {
  if (!language && !whatsapp) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {language && (language === "PORTUGUESE" ? "Portuguese" : "English")}
      {language && whatsapp && " · "}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          WhatsApp {whatsapp}
        </a>
      )}
    </p>
  );
}

/**
 * Place a student into any time (adminBookStudent, always confirmed). The
 * parent runs the action; this collects the student, date, time and length.
 */
export function ManualBookingForm({
  students,
  defaultDate,
  disabled,
  onBook,
  idPrefix = "override",
}: {
  students: Student[];
  defaultDate: string;
  disabled: boolean;
  onBook: (studentId: string, startIso: string, endIso: string) => void;
  /** Keeps the field ids unique when the form appears twice on a page. */
  idPrefix?: string;
}) {
  const { tzLabel } = useDeviceTime();
  const [form, setForm] = useState({
    studentId: students[0]?.id ?? "",
    date: defaultDate,
    time: "10:00",
    durationMinutes: "60",
  });

  function submit() {
    const start = new Date(`${form.date}T${form.time}:00`);
    const end = new Date(start.getTime() + Number(form.durationMinutes) * 60000);
    onBook(form.studentId, start.toISOString(), end.toISOString());
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-student`}>Student</Label>
        <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
          <SelectTrigger id={`${idPrefix}-student`} className="w-56">
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-date`}>Date</Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-time`}>
          Time{tzLabel && <span className="font-normal text-muted-foreground"> ({tzLabel})</span>}
        </Label>
        <Input
          id={`${idPrefix}-time`}
          type="time"
          value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-duration`}>Duration (min)</Label>
        <Input
          id={`${idPrefix}-duration`}
          type="number"
          className="w-24"
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
        />
      </div>
      <Button onClick={submit} disabled={disabled || !form.studentId}>
        Book student
      </Button>
    </>
  );
}
