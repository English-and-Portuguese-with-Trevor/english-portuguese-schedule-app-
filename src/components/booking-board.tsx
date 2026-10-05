"use client";

import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { cancelBooking, flagClass, requestBooking, requestReschedule, unflagClass } from "@/lib/actions/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelBookingDialog, type CancellableBooking } from "@/components/cancel-booking-dialog";
import { FlagClassDialog } from "@/components/flag-class-dialog";
import { SlotPicker, timeZoneLabel, type BusySlotDTO, type CandidateSlotDTO } from "@/components/slot-picker";
import { createClient } from "@/lib/supabase/client";
import { useSiteLanguage, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { Booking, BookingAnswers, FlagReason, Role } from "@/lib/types";

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
  recentClasses = [],
  canFlag = false,
  shortClasses = false,
  previousAnswers,
}: {
  role: Role;
  candidates: CandidateSlotDTO[];
  busySlots: BusySlotDTO[];
  myBookings: BookingRow[];
  /** Confirmed classes of the last few days, which can still be flagged. */
  recentClasses?: BookingRow[];
  /** Students with lesson access can flag their classes. */
  canFlag?: boolean;
  /** Not marked as Trevor's student yet: the times are 30-minute classes. */
  shortClasses?: boolean;
  previousAnswers?: Partial<BookingAnswers>;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<CancellableBooking | null>(null);
  const [flagging, setFlagging] = useState<{ id: string; startTime: string } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const t = useT();
  const lang = useSiteLanguage();
  const tzLabel = useMemo(() => timeZoneLabel(lang) ?? t("your local time"), [lang, t]);

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
    if (result.error) return t(result.error);
    setNotice({
      kind: "success",
      text: result.pending ? t("Request sent — Trevor needs to approve it.") : t("Class booked."),
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
    if (!rescheduling) return t("Pick the class to move first.");
    const result = await requestReschedule(
      rescheduling.id,
      start,
      end,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (result.error) return t(result.error);
    setRescheduling(null);
    setNotice({ kind: "success", text: t("Reschedule request sent — Trevor needs to approve it.") });
    return null;
  }

  async function handleCancel(bookingId: string) {
    const result = await cancelBooking(bookingId);
    if (result.error) return t(result.error);
    setNotice({ kind: "success", text: t("Booking canceled.") });
    return null;
  }

  async function handleFlag(bookingId: string, reason: FlagReason) {
    const result = await flagClass(bookingId, reason);
    if (result.error) return t(result.error);
    setNotice({ kind: "success", text: t("Thanks. Trevor will get in touch.") });
    return null;
  }

  async function handleUnflag(bookingId: string) {
    const result = await unflagClass(bookingId);
    setNotice(result.error ? { kind: "error", text: t(result.error) } : { kind: "success", text: t("Flag removed.") });
  }

  // The flag at the top right of a confirmed class; once sent, "Flagged", which takes it back.
  function flagControl(b: BookingRow) {
    if (!canFlag || b.status !== "CONFIRMED" || !b.session_slots) return null;
    if (b.flag_reason) {
      return (
        <Button
          variant="secondary"
          size="sm"
          className="-mr-2 -mt-2 shrink-0"
          title={t("Remove flag")}
          onClick={() => handleUnflag(b.id)}
        >
          <Flag className="size-4 fill-current" aria-hidden />
          {t("Flagged")}
        </Button>
      );
    }
    const startTime = b.session_slots.start_time;
    return (
      <Button
        variant="ghost"
        size="icon"
        className="-mr-2 -mt-2 size-8 shrink-0 text-muted-foreground"
        title={t("Flag a problem")}
        aria-label={t("Flag a problem")}
        onClick={() => setFlagging({ id: b.id, startTime })}
      >
        <Flag className="size-4" aria-hidden />
      </Button>
    );
  }

  if (!isClient) {
    return <p className="text-sm text-muted-foreground">{t("Loading…")}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="mb-1 text-xs text-muted-foreground">{t("Times shown in {zone}.", { zone: tzLabel })}</p>
        <h2 className="title mb-3 text-2xl">{t("My bookings")}</h2>
        {myBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("You have no upcoming classes yet.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myBookings.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {b.reschedule_of ? t("Reschedule request") : t("English / Portuguese class")}
                    </CardTitle>
                    {flagControl(b)}
                  </div>
                  <CardDescription>
                    {b.session_slots && formatDate(b.session_slots.start_time, "dayAtTime", lang)}
                    {b.reschedule_of && startById.get(b.reschedule_of) && (
                      <>
                        <br />
                        {t("Moving from {time}", { time: formatDate(startById.get(b.reschedule_of)!, "dayAtTime", lang) })}
                      </>
                    )}
                    {hasPendingReschedule.has(b.id) && (
                      <>
                        <br />
                        {t("Reschedule requested")}
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0">
                  <Badge variant={b.status === "CONFIRMED" ? "success" : "secondary"}>
                    {b.status === "CONFIRMED" ? t("Confirmed") : t("Waiting for approval")}
                  </Badge>
                  <div className="flex gap-2">
                    {b.meet_link && (
                      <Button size="sm" asChild>
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer">
                          {t("Join Meet")}
                        </a>
                      </Button>
                    )}
                    {b.status === "CONFIRMED" && !hasPendingReschedule.has(b.id) && (
                      <Button variant="outline" size="sm" onClick={() => startRescheduling(b)}>
                        {t("Reschedule")}
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
                      {t("Cancel")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {canFlag && recentClasses.length > 0 && (
        <section>
          <h2 className="title mb-1 text-2xl">{t("Recent classes")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("Something wrong with a class? Tap its flag to let Trevor know.")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentClasses.map((b) => (
              <Card key={b.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t("English / Portuguese class")}</CardTitle>
                    {flagControl(b)}
                  </div>
                  <CardDescription>
                    {b.session_slots && formatDate(b.session_slots.start_time, "dayAtTime", lang)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section ref={pickerRef} className="scroll-mt-4">
        <h2 className="title mb-3 text-2xl">{rescheduling ? t("Pick a new time") : t("Book a class")}</h2>
        {shortClasses && (
          <p className="mb-4 text-sm text-muted-foreground">
            {t("New students book 30-minute classes. Once Trevor adds you as his student, you can book longer classes.")}
          </p>
        )}
        {rescheduling && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-sm">
            <span>
              {t("Moving your class on {time}. It stays booked until Trevor approves the new time.", {
                time: formatDate(rescheduling.start, "dayAtTime", lang),
              })}
            </span>
            <Button variant="outline" size="sm" onClick={() => setRescheduling(null)}>
              {t("Stop")}
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
      <FlagClassDialog booking={flagging} onClose={() => setFlagging(null)} onFlag={handleFlag} />

      {notice && (
        <div
          role="status"
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-lg",
            // Clear the admin's bottom tab bar on phones.
            role === "admin" && "bottom-20 sm:bottom-4",
            notice.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-destructive/40 bg-background text-destructive",
          )}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
