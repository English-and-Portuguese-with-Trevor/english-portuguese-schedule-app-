"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cancelBooking, requestBooking, requestReschedule } from "@/lib/actions/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelBookingDialog, type CancellableBooking } from "@/components/cancel-booking-dialog";
import { SlotPicker, type BusySlotDTO, type CandidateSlotDTO } from "@/components/slot-picker";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Booking, BookingAnswers, Role } from "@/lib/types";

type BookingRow = Booking & {
  session_slots: {
    start_time: string;
    end_time: string;
  } | null;
};

type Notice = { kind: "success" | "error"; text: string };

const noopSubscribe = () => () => {};

export function BookingBoard({
  role,
  candidates,
  busySlots,
  myBookings,
  previousAnswers,
}: {
  role: Role;
  candidates: CandidateSlotDTO[];
  busySlots: BusySlotDTO[];
  myBookings: BookingRow[];
  previousAnswers?: Partial<BookingAnswers>;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<CancellableBooking | null>(null);
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

  async function handleBookSlot(start: string, end: string, answers?: BookingAnswers) {
    const result = await requestBooking(start, end, Intl.DateTimeFormat().resolvedOptions().timeZone, answers);
    if (result.error) return result.error;
    setNotice({
      kind: "success",
      text: result.pending ? "Request sent — Trevor needs to approve it." : "Session booked.",
    });
    return null;
  }

  // Rescheduling: the picker below chooses a new time for this lesson.
  const [rescheduling, setRescheduling] = useState<{ id: string; start: string } | null>(null);
  const pickerRef = useRef<HTMLElement>(null);
  const startById = new Map(myBookings.map((b) => [b.id, b.session_slots?.start_time ?? null]));
  const hasPendingReschedule = new Set(
    myBookings.filter((b) => b.status === "PENDING" && b.reschedule_of).map((b) => b.reschedule_of),
  );

  function startRescheduling(booking: BookingRow) {
    if (!booking.session_slots) return;
    setRescheduling({ id: booking.id, start: booking.session_slots.start_time });
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleReschedule(start: string, end: string) {
    if (!rescheduling) return "Pick the lesson to move first.";
    const result = await requestReschedule(
      rescheduling.id,
      start,
      end,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (result.error) return result.error;
    setRescheduling(null);
    setNotice({ kind: "success", text: "Reschedule request sent — Trevor needs to approve it." });
    return null;
  }

  async function handleCancel(bookingId: string) {
    const result = await cancelBooking(bookingId);
    if (result.error) return result.error;
    setNotice({ kind: "success", text: "Booking cancelled." });
    return null;
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
                    {b.reschedule_of ? "Reschedule request" : "English / Portuguese Lesson"}
                  </CardTitle>
                  <CardDescription>
                    {b.session_slots &&
                      format(new Date(b.session_slots.start_time), "EEE, MMM d 'at' h:mm a")}
                    {b.reschedule_of && startById.get(b.reschedule_of) && (
                      <>
                        <br />
                        Moving from {format(new Date(startById.get(b.reschedule_of)!), "EEE, MMM d 'at' h:mm a")}
                      </>
                    )}
                    {hasPendingReschedule.has(b.id) && (
                      <>
                        <br />
                        Reschedule requested
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0">
                  <Badge variant={b.status === "CONFIRMED" ? "success" : "secondary"}>
                    {b.status === "CONFIRMED" ? "Confirmed" : "Pending"}
                  </Badge>
                  <div className="flex gap-2">
                    {b.meet_link && (
                      <Button size="sm" asChild>
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer">
                          Join Meet
                        </a>
                      </Button>
                    )}
                    {b.status === "CONFIRMED" && !hasPendingReschedule.has(b.id) && (
                      <Button variant="outline" size="sm" onClick={() => startRescheduling(b)}>
                        Reschedule
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        b.session_slots &&
                        setCancelling({ id: b.id, startTime: b.session_slots.start_time, status: b.status })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section ref={pickerRef} className="scroll-mt-4">
        <h2 className="mb-3 text-lg font-semibold">{rescheduling ? "Pick a new time" : "Book a lesson"}</h2>
        {rescheduling && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-secondary px-4 py-3 text-sm">
            <span>
              Moving your lesson on {format(new Date(rescheduling.start), "EEE, MMM d 'at' h:mm a")}. It stays
              booked until Trevor approves the new time.
            </span>
            <Button variant="outline" size="sm" onClick={() => setRescheduling(null)}>
              Stop
            </Button>
          </div>
        )}
        <SlotPicker
          role={role}
          candidates={candidates}
          busySlots={busySlots}
          onBook={rescheduling ? handleReschedule : handleBookSlot}
          previousAnswers={previousAnswers}
          rescheduleFrom={rescheduling?.start}
        />
      </section>

      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} onCancel={handleCancel} />

      {notice && (
        <div
          role="status"
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-md border px-4 py-3 text-sm shadow-lg",
            // Clear the admin's bottom tab bar on phones.
            role === "admin" && "bottom-20 sm:bottom-4",
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
