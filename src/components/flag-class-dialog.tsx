"use client";

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
import { useSiteLanguage, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { FLAG_REASONS, type FlagReason } from "@/lib/types";

/** Picks one of the set reasons for flagging a class; there's no note to write. */
export function FlagClassDialog({
  booking,
  onClose,
  onFlag,
}: {
  booking: { id: string; startTime: string } | null;
  onClose: () => void;
  /** Resolves to an error message, or null on success. */
  onFlag: (bookingId: string, reason: FlagReason) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useT();
  const lang = useSiteLanguage();

  function close() {
    setError(null);
    onClose();
  }

  function flag(reason: FlagReason) {
    if (!booking) return;
    setError(null);
    startTransition(async () => {
      const result = await onFlag(booking.id, reason);
      if (result) setError(result);
      else close();
    });
  }

  return (
    <Dialog open={booking !== null} onOpenChange={(open) => !open && !isPending && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("What went wrong?")}</DialogTitle>
          <DialogDescription>
            {booking && formatDate(booking.startTime, "longDayAtTime", lang)}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("Trevor gets a message and will contact you.")}</p>
        <div className="flex flex-col gap-2">
          {(Object.keys(FLAG_REASONS) as FlagReason[]).map((reason) => (
            <Button key={reason} variant="outline" disabled={isPending} onClick={() => flag(reason)}>
              {t(FLAG_REASONS[reason])}
            </Button>
          ))}
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t(error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={isPending} onClick={close}>
            {t("Never mind")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
