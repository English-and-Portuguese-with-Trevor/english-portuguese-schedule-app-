"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { adminBookStudent, cancelBooking, confirmBooking } from "@/lib/actions/bookings";
import { LateCancellations, type LateCancellationRow } from "@/components/admin/late-cancellations";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BookingRow {
  id: string;
  student_id: string;
  status: string;
  is_admin_override: boolean;
  meet_link: string | null;
  lesson_language: string | null;
  whatsapp: string | null;
  session_slots: {
    start_time: string;
    end_time: string;
  } | null;
}

interface Student {
  id: string;
  name: string;
}

export function BookingsManager({
  initialBookings,
  lateCancellations,
  students,
  displayNames,
}: {
  initialBookings: BookingRow[];
  lateCancellations: LateCancellationRow[];
  students: Student[];
  displayNames: Record<string, string>;
}) {
  const router = useRouter();
  const [prevInitialBookings, setPrevInitialBookings] = useState(initialBookings);
  const [bookings, setBookings] = useState(initialBookings);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    studentId: students[0]?.id ?? "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    durationMinutes: "60",
  });

  if (initialBookings !== prevInitialBookings) {
    setPrevInitialBookings(initialBookings);
    setBookings(initialBookings);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  function handleConfirm(id: string) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "CONFIRMED" } : b)));
    startTransition(() => {
      void confirmBooking(id);
    });
  }

  function handleCancel(id: string) {
    setBookings((prev) => prev.filter((b) => b.id !== id));
    startTransition(() => {
      void cancelBooking(id);
    });
  }

  function handleOverrideBook() {
    setError(null);
    const start = new Date(`${overrideForm.date}T${overrideForm.time}:00`);
    const end = new Date(start.getTime() + Number(overrideForm.durationMinutes) * 60000);
    startTransition(async () => {
      const result = await adminBookStudent(
        overrideForm.studentId,
        start.toISOString(),
        end.toISOString(),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  const pending = bookings.filter((b) => b.status === "PENDING");
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Approve requests, cancel sessions, or place a student into any time. Sessions you book are
          confirmed right away.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual override booking</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label>Student</Label>
            <Select
              value={overrideForm.studentId}
              onValueChange={(v) => setOverrideForm({ ...overrideForm, studentId: v })}
            >
              <SelectTrigger className="w-56">
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
            <Label>Date</Label>
            <Input
              type="date"
              value={overrideForm.date}
              onChange={(e) => setOverrideForm({ ...overrideForm, date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={overrideForm.time}
              onChange={(e) => setOverrideForm({ ...overrideForm, time: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Duration (min)</Label>
            <Input
              type="number"
              className="w-24"
              value={overrideForm.durationMinutes}
              onChange={(e) => setOverrideForm({ ...overrideForm, durationMinutes: e.target.value })}
            />
          </div>
          <Button onClick={handleOverrideBook} disabled={isPending || !overrideForm.studentId}>
            Book student
          </Button>
        </CardContent>
        {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pending requests ({pending.length})</h2>
        <div className="flex flex-col gap-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
          {pending.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border px-4 py-3">
              <div>
                <p className="text-sm font-medium">{displayNames[b.student_id] ?? "Unknown"}</p>
                <p className="text-sm text-muted-foreground">
                  {b.session_slots && format(new Date(b.session_slots.start_time), "EEE, MMM d 'at' h:mm a")}
                </p>
                <BookingAnswersLine language={b.lesson_language} whatsapp={b.whatsapp} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleConfirm(b.id)}>
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCancel(b.id)}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Confirmed upcoming ({confirmed.length})</h2>
        <div className="flex flex-col gap-2">
          {confirmed.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border px-4 py-3">
              <div>
                <p className="text-sm font-medium">{displayNames[b.student_id] ?? "Unknown"}</p>
                <p className="text-sm text-muted-foreground">
                  {b.session_slots && format(new Date(b.session_slots.start_time), "EEE, MMM d 'at' h:mm a")}
                </p>
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
                <Button variant="outline" size="sm" onClick={() => handleCancel(b.id)}>
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <LateCancellations rows={lateCancellations} displayNames={displayNames} />
    </div>
  );
}

/** The student's booking answers: lesson language and a tap-to-chat WhatsApp link. */
function BookingAnswersLine({ language, whatsapp }: { language: string | null; whatsapp: string | null }) {
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
