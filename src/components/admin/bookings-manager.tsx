"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminBookStudent } from "@/lib/actions/bookings";
import {
  BookingItem,
  ManualBookingForm,
  useAdminBookings,
  useDeviceTime,
  type AdminBookingRow,
  type Student,
} from "@/components/admin/booking-parts";
import { LateCancellations, type LateCancellationRow } from "@/components/admin/late-cancellations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Who made the class: students' own bookings, Trevor's (override), or both (Trevor, 2026-10-03: his regulars' series buried the rest). */
const WHO_BOOKED = [
  { value: "all", label: "All" },
  { value: "students", label: "Booked by students" },
  { value: "mine", label: "Booked by me" },
] as const;
type WhoBooked = (typeof WHO_BOOKED)[number]["value"];

export function BookingsManager({
  initialBookings,
  lateCancellations,
  students,
  displayNames,
}: {
  initialBookings: AdminBookingRow[];
  lateCancellations: LateCancellationRow[];
  students: Student[];
  displayNames: Record<string, string>;
}) {
  const router = useRouter();
  const { tzLabel } = useDeviceTime();
  const { bookings, confirm, cancel, error, setError, isPending, startTransition } = useAdminBookings(
    initialBookings,
    "admin-bookings-live",
  );

  function handleOverrideBook(studentId: string, startIso: string, endIso: string) {
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

  const [who, setWho] = useState<WhoBooked>("all");
  const pending = bookings.filter((b) => b.status === "PENDING");
  const confirmed = bookings.filter(
    (b) => b.status === "CONFIRMED" && (who === "all" || (who === "mine") === b.is_admin_override),
  );
  const startById = new Map(
    bookings.filter((b) => b.status !== "CANCELLED").map((b) => [b.id, b.session_slots?.start_time ?? null]),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Approve requests, cancel sessions, or place a student into any time. Sessions you book are
          confirmed right away.
        </p>
        {tzLabel && <p className="text-xs text-muted-foreground">Times shown in {tzLabel}.</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual override booking</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <ManualBookingForm
            students={students}
            defaultDate={format(new Date(), "yyyy-MM-dd")}
            disabled={isPending}
            onBook={handleOverrideBook}
          />
        </CardContent>
        {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pending requests ({pending.length})</h2>
        <div className="flex flex-col gap-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
          {pending.map((b) => (
            <BookingItem
              key={b.id}
              booking={b}
              name={displayNames[b.student_id] ?? "Unknown"}
              originalStart={b.reschedule_of ? (startById.get(b.reschedule_of) ?? null) : null}
              onConfirm={confirm}
              onCancel={cancel}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Confirmed upcoming ({confirmed.length})</h2>
          <div role="group" aria-label="Who booked" className="inline-flex rounded-md border p-0.5">
            {WHO_BOOKED.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={who === option.value}
                onClick={() => setWho(option.value)}
                className={cn(
                  "rounded px-2.5 py-1 text-sm text-muted-foreground",
                  who === option.value && "bg-accent text-accent-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {confirmed.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
          {confirmed.map((b) => (
            <BookingItem
              key={b.id}
              booking={b}
              name={displayNames[b.student_id] ?? "Unknown"}
              originalStart={null}
              onConfirm={confirm}
              onCancel={cancel}
            />
          ))}
        </div>
      </section>

      <LateCancellations rows={lateCancellations} displayNames={displayNames} />
    </div>
  );
}
