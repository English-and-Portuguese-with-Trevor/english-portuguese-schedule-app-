import { format } from "date-fns";

import type { SiteLanguage } from "@/lib/prefs";
import { translate } from "@/i18n/translate";

// Dates and times in the site language, in the viewer's time zone. English
// keeps the date-fns patterns the app has always used; other languages use
// the browser's own wording and 24-hour or 12-hour clock.
type Kind =
  | "dayAtTime" // Sat, Sep 27 at 10:00 AM
  | "longDayAtTime" // Saturday, September 27 at 10:00 AM
  | "longDay" // Saturday, September 27
  | "weekday" // Sat
  | "dayNumber" // 27
  | "time"; // 10:00 AM

const ENGLISH: Record<Kind, string> = {
  dayAtTime: "EEE, MMM d 'at' h:mm a",
  longDayAtTime: "EEEE, MMMM d 'at' h:mm a",
  longDay: "EEEE, MMMM d",
  weekday: "EEE",
  dayNumber: "d",
  time: "h:mm a",
};

const OPTIONS: Record<
  Exclude<Kind, "dayAtTime" | "longDayAtTime">,
  Intl.DateTimeFormatOptions
> = {
  longDay: { weekday: "long", month: "long", day: "numeric" },
  weekday: { weekday: "short" },
  dayNumber: { day: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
};

const LOCALES: Record<SiteLanguage, string> = {
  en: "en-US",
  es: "es",
  pt: "pt-BR",
  fr: "fr",
};

export function formatDate(
  date: Date | string,
  kind: Kind,
  lang: SiteLanguage,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (lang === "en") return format(d, ENGLISH[kind]);
  const locale = LOCALES[lang];
  if (kind === "dayAtTime" || kind === "longDayAtTime") {
    const day = new Intl.DateTimeFormat(
      locale,
      kind === "dayAtTime"
        ? { weekday: "short", month: "short", day: "numeric" }
        : OPTIONS.longDay,
    ).format(d);
    const time = new Intl.DateTimeFormat(locale, OPTIONS.time).format(d);
    return translate(lang, "{day} at {time}", { day, time });
  }
  return new Intl.DateTimeFormat(locale, OPTIONS[kind]).format(d);
}

/** "10:00 – 11:00 AM" (English) or the language's own range wording. */
export function formatTimeRange(
  start: Date,
  end: Date,
  lang: SiteLanguage,
): string {
  if (lang === "en")
    return `${format(start, "h:mm")} – ${format(end, "h:mm a")}`;
  return `${formatDate(start, "time", lang)} – ${formatDate(end, "time", lang)}`;
}

/** Full date for billing lines, e.g. "October 27, 2026". */
export function formatFullDate(iso: string, lang: SiteLanguage): string {
  return new Date(iso).toLocaleDateString(LOCALES[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export { LOCALES };
