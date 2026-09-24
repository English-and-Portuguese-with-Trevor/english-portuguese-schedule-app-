"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

import { cancelBooking, requestBooking, requestClassBooking } from "@/lib/actions/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SlotPicker, type BusySlotDTO, type CandidateSlotDTO } from "@/components/slot-picker";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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

type Notice = { kind: "success" | "error"; text: string };

const noopSubscribe = () => () => {};

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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Every time here is shown in the viewer's timezone, which the server
  // (UTC) can't know — so this renders on the client only.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleBookSlot(start: string, end: string) {
    const result = await requestBooking(start, end);
    if (result.error) return result.error;
    setNotice({
      kind: "success",
      text: role === "admin" ? "Session booked." : "Request sent — it's pending confirmation.",
    });
    return null;
  }

  function handleBookClass(cls: OpenClass) {
    setBusyKey(cls.id);
    startTransition(async () => {
      const result = await requestClassBooking(cls.id);
      setNotice(result.error ? { kind: "error", text: result.error } : { kind: "success", text: "Class requested." });
      setBusyKey(null);
    });
  }

  function handleCancel(bookingId: string) {
    setBusyKey(bookingId);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      setNotice(result.error ? { kind: "error", text: result.error } : { kind: "success", text: "Booking cancelled." });
      setBusyKey(null);
    });
  }

  if (!isClient) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
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
        <h2 className="mb-3 text-lg font-semibold">Book a 1:1 session</h2>
        <SlotPicker role={role} candidates={candidates} busySlots={busySlots} onBook={handleBookSlot} />
      </section>

      {notice && (
        <div
          role="status"
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-md border px-4 py-3 text-sm shadow-lg",
            notice.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-destructive/40 bg-background text-destructive",
          )}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
