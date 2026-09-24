"use client";

import { differenceInMinutes, format } from "date-fns";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LATE_CANCEL_HOURS } from "@/lib/types";

export interface CancellableBooking {
  id: string;
  startTime: string;
  status: string;
}

/**
 * Only a confirmed session counts when cancelled late; a request that was
 * never approved can always be withdrawn.
 */
export function isLateCancellation(booking: CancellableBooking, now = new Date()) {
  return (
    booking.status === "CONFIRMED" &&
    differenceInMinutes(new Date(booking.startTime), now) < LATE_CANCEL_HOURS * 60
  );
}

export function CancelBookingDialog({
  booking,
  onClose,
  onCancel,
}: {
  booking: CancellableBooking | null;
  onClose: () => void;
  /** Resolves to an error message, or null on success. */
  onCancel: (bookingId: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const late = booking !== null && isLateCancellation(booking);

  function close() {
    setError(null);
    onClose();
  }

  function confirm() {
    if (!booking) return;
    setError(null);
    startTransition(async () => {
      const result = await onCancel(booking.id);
      if (result) setError(result);
      else close();
    });
  }

  return (
    <Dialog open={booking !== null} onOpenChange={(open) => !open && !isPending && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{booking?.status === "PENDING" ? "Withdraw this request?" : "Cancel this session?"}</DialogTitle>
          <DialogDescription>
            {booking && format(new Date(booking.startTime), "EEEE, MMMM d 'at' h:mm a")}
          </DialogDescription>
        </DialogHeader>
        {late ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This session starts in less than {LATE_CANCEL_HOURS} hours, so it will still count as a class.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">The time will open up for other students.</p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={isPending} onClick={close}>
            Keep it
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={confirm}>
            {isPending
              ? "Cancelling…"
              : booking?.status === "PENDING"
                ? "Withdraw request"
                : late
                  ? "Cancel anyway"
                  : "Cancel session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
