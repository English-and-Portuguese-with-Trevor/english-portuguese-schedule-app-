"use client";

import { formatDate } from "@/i18n/format";
import { useSiteLanguage, useT } from "@/i18n/client";

export type ClassNote = { bookingId: string; start: string; notes: string };

/**
 * Trevor's notes after each class (what they covered, homework, new words),
 * newest class first, each folded under its date. Shown exactly as written:
 * never translated, line breaks kept, links not turned into links.
 */
export function ClassNotes({ notes }: { notes: ClassNote[] }) {
  const t = useT();
  const lang = useSiteLanguage();
  if (notes.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t("Notes from Trevor")}</h2>
      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <details key={n.bookingId} className="rounded-xl border bg-card px-4 py-3">
            <summary className="cursor-pointer font-medium">{formatDate(n.start, "dayAtTime", lang)}</summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{n.notes}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
