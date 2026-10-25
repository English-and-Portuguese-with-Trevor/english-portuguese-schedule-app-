"use client";

import { useState, useTransition } from "react";

import { useT } from "@/i18n/client";

export type HomeworkItem = { id: string; text: string; doneAt: string | null };

/**
 * The homework Trevor gives on the student hub (admin dashboard, landing
 * repo): up to ten things to do between classes. Each line is shown exactly
 * as written and ticked off here (mark_homework); Trevor sees the ticks on
 * the hub. Open items first, done ones struck through under them.
 */
export function Homework({
  items,
  onMark,
}: {
  items: HomeworkItem[];
  /** Resolves to an error message, or null on success. */
  onMark: (id: string, done: boolean) => Promise<{ error: string | null }>;
}) {
  const t = useT();
  const [done, setDone] = useState(() => new Set(items.filter((i) => i.doneAt).map((i) => i.id)));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (items.length === 0) return null;

  function toggle(id: string) {
    const next = !done.has(id);
    setError(null);
    setDone((d) => {
      const set = new Set(d);
      if (next) set.add(id);
      else set.delete(id);
      return set;
    });
    startTransition(async () => {
      const result = await onMark(id, next);
      if (result.error) {
        setError(result.error);
        setDone((d) => {
          const set = new Set(d);
          if (next) set.delete(id);
          else set.add(id);
          return set;
        });
      }
    });
  }

  const ordered = [...items].sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id)));
  return (
    <section>
      <h2 className="title mb-1 text-2xl">{t("Homework from Trevor")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("Tick each one when it's done.")}</p>
      <ul className="glass flex flex-col gap-1 rounded-2xl px-4 py-3">
        {ordered.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 py-1.5">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-current" checked={done.has(item.id)} onChange={() => toggle(item.id)} />
              <span className={done.has(item.id) ? "text-muted-foreground line-through" : ""}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </section>
  );
}
