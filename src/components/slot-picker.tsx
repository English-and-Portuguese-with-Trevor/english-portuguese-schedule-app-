"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WHATSAPP_PATTERN, type BookingAnswers, type LessonLanguage, type Role } from "@/lib/types";
import { useSiteLanguage, useT } from "@/i18n/client";
import { formatDate, formatTimeRange, LOCALES } from "@/i18n/format";
import { tr } from "@/i18n/translate";
import type { SiteLanguage } from "@/lib/prefs";

export interface CandidateSlotDTO {
  start: string;
  end: string;
  needsApproval: boolean;
}

export interface BusySlotDTO {
  start: string;
  end: string;
  studentName?: string;
  /** The booking's note, shown to the admin after the name (e.g. "Hold: Tim"). */
  note?: string;
}

const DAYS_SHOWN = 14;
const STEP_MS = 15 * 60 * 1000;

interface DaySlot {
  start: Date;
  end: Date;
  /** Overlaps an existing booking. */
  blocked: boolean;
  needsApproval: boolean;
}

interface Busy {
  start: Date;
  end: Date;
  studentName?: string;
  note?: string;
}

interface DayInfo {
  blocks: DaySlot[][];
  busy: Busy[];
  selectableCount: number;
}

/** The viewer's time zone as a readable name, e.g. "Mountain Daylight Time". */
export function timeZoneLabel(lang?: SiteLanguage) {
  return (
    new Intl.DateTimeFormat(lang && lang !== "en" ? LOCALES[lang] : undefined, { timeZoneName: "long" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? null
  );
}

export function SlotPicker({
  role,
  candidates,
  busySlots,
  onBook,
  previousAnswers,
  rescheduleFrom,
}: {
  role: Role;
  candidates: CandidateSlotDTO[];
  busySlots: BusySlotDTO[];
  /** Resolves to an error message, or null on success. Students always send answers. */
  onBook: (start: string, end: string, answers?: BookingAnswers) => Promise<string | null>;
  /** The student's answers from their last booking, to prefill the questions. */
  previousAnswers?: Partial<BookingAnswers>;
  /** Set while a student picks a new time for an existing lesson (ISO start). */
  rescheduleFrom?: string;
}) {
  const isAdmin = role === "admin";
  const t = useT();
  const lang = useSiteLanguage();
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)), [today]);

  const byDay = useMemo(() => {
    const busy: Busy[] = busySlots.map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
      studentName: b.studentName,
      note: b.note,
    }));

    const map = new Map<string, DayInfo>();
    for (const day of days) {
      const slots: DaySlot[] = candidates
        .filter((c) => isSameDay(new Date(c.start), day))
        .map((c) => {
          const start = new Date(c.start);
          const end = new Date(c.end);
          const blocked = busy.some((b) => start < b.end && end > b.start);
          return { start, end, blocked, needsApproval: c.needsApproval };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // Consecutive 15-minute starts belong to the same availability window.
      const blocks: DaySlot[][] = [];
      for (const slot of slots) {
        const current = blocks[blocks.length - 1];
        const prev = current?.[current.length - 1];
        if (prev && slot.start.getTime() - prev.start.getTime() === STEP_MS) current.push(slot);
        else blocks.push([slot]);
      }

      map.set(format(day, "yyyy-MM-dd"), {
        blocks,
        busy: busy.filter((b) => isSameDay(b.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime()),
        selectableCount: slots.filter((s) => !s.blocked).length,
      });
    }
    return map;
  }, [candidates, busySlots, days]);

  const firstDayWithOpenings = days.find((d) => (byDay.get(format(d, "yyyy-MM-dd"))?.selectableCount ?? 0) > 0);
  const [selectedKey, setSelectedKey] = useState(() => format(firstDayWithOpenings ?? today, "yyyy-MM-dd"));
  const selectedDay = days.find((d) => format(d, "yyyy-MM-dd") === selectedKey) ?? today;
  const info = byDay.get(selectedKey);

  const [pendingSlot, setPendingSlot] = useState<DaySlot | null>(null);
  const [language, setLanguage] = useState<LessonLanguage | null>(previousAnswers?.language ?? null);
  const [whatsapp, setWhatsapp] = useState(previousAnswers?.whatsapp ?? "");
  // WhatsApp is optional, but if given it has to look like a phone number.
  const whatsappValid = whatsapp.trim() === "" || WHATSAPP_PATTERN.test(whatsapp.trim());
  // Reschedules keep the original lesson's answers, so nothing to ask.
  const askQuestions = !isAdmin && !rescheduleFrom;
  const answersValid = !askQuestions || (language !== null && whatsappValid);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tzLabel = useMemo(() => timeZoneLabel(lang) ?? t("your local time"), [lang, t]);

  function confirm() {
    if (!pendingSlot) return;
    setDialogError(null);
    startTransition(async () => {
      const answers = !askQuestions || !language ? undefined : { language, whatsapp: whatsapp.trim() };
      const error = await onBook(pendingSlot.start.toISOString(), pendingSlot.end.toISOString(), answers);
      if (error) setDialogError(t(error));
      else setPendingSlot(null);
    });
  }

  // Admin bookings are always confirmed, so only students see the approval marker.
  const showsApproval = (slot: DaySlot) => !isAdmin && slot.needsApproval && !slot.blocked;
  const hasApprovalSlots = info?.blocks.some((b) => b.some(showsApproval)) ?? false;
  const pendingNeedsApproval = pendingSlot !== null && !isAdmin && pendingSlot.needsApproval;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{t("Times shown in {zone}.", { zone: tzLabel })}</p>
      {isAdmin && (
        // Admin-only text stays in English. The calendar is read-only for the
        // admin; booking here would make Trevor his own student.
        <p className="text-sm text-muted-foreground">Free times are shown. To book for a student, use Bookings › Manual booking.</p>
      )}

      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const count = byDay.get(key)?.selectableCount ?? 0;
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={`${formatDate(day, "longDay", lang)}, ${count > 0 ? t("{n} open", { n: count }) : t("no availability")}`}
              onClick={() => setSelectedKey(key)}
              className={cn(
                "flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors",
                selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                !selected && count === 0 && "opacity-50",
              )}
            >
              <span className="text-[11px] font-medium uppercase">{formatDate(day, "weekday", lang)}</span>
              <span className="text-lg font-semibold leading-none">{formatDate(day, "dayNumber", lang)}</span>
              <span className={cn("text-[10px]", selected ? "opacity-80" : "text-muted-foreground")}>
                {count > 0 ? t("{n} open", { n: count }) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">{formatDate(selectedDay, "longDay", lang)}</h3>

        {info && info.busy.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1">
            {info.busy.map((b) => (
              <li
                key={b.start.toISOString()}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
              >
                {formatTimeRange(b.start, b.end, lang)} · {t("Booked")}
                {isAdmin && b.studentName ? ` (${b.studentName})` : ""}
                {isAdmin && b.note && <span className="text-muted-foreground"> · {b.note}</span>}
              </li>
            ))}
          </ul>
        )}

        {!info || info.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No availability on this day.")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {info.blocks.map((block) => (
              <div key={block[0].start.toISOString()}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {formatDate(block[0].start, "time", lang)} – {formatDate(block[block.length - 1].end, "time", lang)}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {block.map((slot) => (
                    <Button
                      key={slot.start.toISOString()}
                      variant="outline"
                      size="sm"
                      disabled={slot.blocked || isAdmin}
                      aria-label={
                        showsApproval(slot)
                          ? t("{time}, needs approval", { time: formatDate(slot.start, "time", lang) })
                          : undefined
                      }
                      onClick={() => {
                        setDialogError(null);
                        setPendingSlot(slot);
                      }}
                      className={cn(slot.blocked && "line-through", showsApproval(slot) && "border-dashed border-muted-foreground/60")}
                    >
                      {formatDate(slot.start, "time", lang)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {hasApprovalSlots && (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Dashed times are less than 72 hours away. You can still request them, but Trevor needs to approve them first.",
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={pendingSlot !== null} onOpenChange={(open) => !open && !isPending && setPendingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rescheduleFrom
                ? t("Request this new time?")
                : pendingNeedsApproval
                  ? t("Request this class?")
                  : t("Book this class?")}
            </DialogTitle>
            <DialogDescription>
              {pendingSlot &&
                `${formatDate(pendingSlot.start, "longDay", lang)} · ${formatTimeRange(
                  pendingSlot.start,
                  pendingSlot.end,
                  lang,
                )} (${tzLabel})`}
            </DialogDescription>
          </DialogHeader>
          {rescheduleFrom ? (
            <p className="text-sm text-muted-foreground">
              {t("Your class on {time} stays booked until Trevor approves the change.", {
                time: formatDate(rescheduleFrom, "longDayAtTime", lang),
              })}
            </p>
          ) : !isAdmin && (
            <p className="text-sm text-muted-foreground">
              {pendingNeedsApproval
                ? t("It's less than 72 hours away, so it stays pending until Trevor approves it.")
                : t("It's confirmed as soon as you book.")}
            </p>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              <a href="/policy" target="_blank" rel="noreferrer" className="underline">
                {t("By booking, you agree to the class policy.")}
              </a>
            </p>
          )}
          {askQuestions && (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("Are you looking for English or Portuguese lessons?")}</legend>
                <div className="flex gap-2">
                  {(
                    [
                      ["ENGLISH", tr("English")],
                      ["PORTUGUESE", tr("Portuguese")],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={cn(
                        "flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        language === value && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name="lesson-language"
                        value={value}
                        checked={language === value}
                        onChange={() => setLanguage(value)}
                        className="sr-only"
                      />
                      {t(label)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label htmlFor="whatsapp">
                  {t("WhatsApp number")} <span className="font-normal text-muted-foreground">{t("(optional)")}</span>
                </Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+55 11 91234-5678"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {whatsappValid ? t("Include your country code.") : t("That doesn't look like a phone number.")}
                </p>
              </div>
            </div>
          )}
          {dialogError && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dialogError}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => setPendingSlot(null)}>
              {t("Back")}
            </Button>
            <Button disabled={isPending || !answersValid} onClick={confirm}>
              {isPending ? t("Sending…") : pendingNeedsApproval || rescheduleFrom ? t("Request") : t("Book")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
