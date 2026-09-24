"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cancelBooking, requestBooking, requestClassBooking } from "@/lib/actions/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekCalendar, type BusySlotDTO, type CandidateSlotDTO } from "@/components/week-calendar";
import { createClient } from "@/lib/supabase/client";
import type { Booking, Role } from "@/lib/types";

interface OpenClass {
  id: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  title: string;
}

type BookingRow = Booking & {
  session_slots: {
    start_time: string;
    end_time: string;
    type: string;
    recurring_groups: { title: string } | null;
  } | null;
};

export function BookingBoard({
  role,
  candidates,
  busySlots,
  openClasses,
  myBookings,
}: {
  role: Role;
  candidates: CandidateSlotDTO[];
  busySlots: BusySlotDTO[];
  openClasses: OpenClass[];
  myBookings: BookingRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "session_slots" }, () =>
        router.refresh(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  function handleBookSlot(start: string, end: string) {
    setError(null);
    setBusyKey(start);
    startTransition(async () => {
      const result = await requestBooking(start, end);
      if (result.error) setError(result.error);
      setBusyKey(null);
    });
  }

  function handleBookClass(cls: OpenClass) {
    setError(null);
    setBusyKey(cls.id);
    startTransition(async () => {
      const result = await requestClassBooking(cls.id);
      if (result.error) setError(result.error);
      setBusyKey(null);
    });
  }

  function handleCancel(bookingId: string) {
    setError(null);
    setBusyKey(bookingId);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (result.error) setError(result.error);
      setBusyKey(null);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">My bookings</h2>
        {myBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no upcoming sessions yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myBookings.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {b.session_slots?.recurring_groups?.title ?? "1:1 Session"}
                  </CardTitle>
                  <CardDescription>
                    {b.session_slots &&
                      format(new Date(b.session_slots.start_time), "EEE, MMM d 'at' h:mm a")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0">
                  <Badge variant={b.status === "CONFIRMED" ? "success" : "secondary"}>
                    {b.status === "CONFIRMED" ? "Confirmed" : "Pending"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending && busyKey === b.id}
                    onClick={() => handleCancel(b.id)}
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {openClasses.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Group classes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {openClasses.map((cls) => (
              <Card key={cls.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{cls.title}</CardTitle>
                  <CardDescription>
                    {format(new Date(cls.startTime), "EEE, MMM d 'at' h:mm a")} ·{" "}
                    {cls.maxCapacity - cls.bookedCount} spot
                    {cls.maxCapacity - cls.bookedCount === 1 ? "" : "s"} left
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    size="sm"
                    disabled={isPending && busyKey === cls.id}
                    onClick={() => handleBookClass(cls)}
                  >
                    Join class
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">1:1 session availability</h2>
        <WeekCalendar
          role={role}
          candidates={candidates}
          busySlots={busySlots}
          onBookSlot={handleBookSlot}
          isPending={isPending}
          busyKey={busyKey}
        />
      </section>
    </div>
  );
}
