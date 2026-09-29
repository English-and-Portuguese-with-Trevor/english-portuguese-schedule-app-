"use client";

import { differenceInMinutes } from "date-fns";
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
import { timeZoneLabel } from "@/components/slot-picker";
import { useSiteLanguage, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { LATE_CANCEL_HOURS } from "@/lib/types";

export interface CancellableBooking {
  id: string;
  startTime: string;
  status: string;
}

/**
 * Only a confirmed session counts when canceled late; a request that was
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
  const t = useT();
  const lang = useSiteLanguage();
  const tzLabel = timeZoneLabel(lang) ?? t("your local time");

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
          <DialogTitle>{booking?.status === "PENDING" ? t("Withdraw this request?") : t("Cancel this class?")}</DialogTitle>
          <DialogDescription>
            {booking && `${formatDate(booking.startTime, "longDayAtTime", lang)} (${tzLabel})`}
          </DialogDescription>
        </DialogHeader>
        {late ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            {t("This class starts in less than {hours} hours, so it still counts as a class.", {
              hours: LATE_CANCEL_HOURS,
            })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("The time will open up for other students.")}</p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t(error)}
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={isPending} onClick={close}>
            {t("Keep it")}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={confirm}>
            {isPending
              ? t("Canceling…")
              : booking?.status === "PENDING"
                ? t("Withdraw request")
                : late
                  ? t("Cancel anyway")
                  : t("Cancel class")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
