"use client";

import { useEffect, useState } from "react";

import { useT } from "@/i18n/client";
import { readPrefs } from "@/lib/prefs";
import { createClient } from "@/lib/supabase/client";

// Trevor's notices (written on the admin dashboard, landing repo), shown
// under the header until dismissed on this device.
const DISMISSED_KEY = "ept-dismissed-notices";

type Notice = { id: number; message: string };

function readDismissed(): number[] {
  try {
    const ids = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function Notices() {
  const t = useT();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function load() {
      const { data, error } = await supabase.rpc("my_announcements", {
        p_learning: readPrefs().learning ?? undefined,
      });
      if (!active || error || !data) return;
      const dismissed = readDismissed();
      setNotices(data.filter((n) => !dismissed.includes(n.id)));
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;
      // Outside the callback: awaiting Supabase inside it can deadlock.
      setTimeout(() => void load().catch(() => {}), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  function dismiss(id: number) {
    try {
      localStorage.setItem(
        DISMISSED_KEY,
        JSON.stringify([...readDismissed().filter((d) => d !== id), id].slice(-50)),
      );
    } catch {}
    setNotices((list) => list.filter((n) => n.id !== id));
  }

  if (!notices.length) return null;
  return (
    <div role="region" aria-label={t("Notices")}>
      {notices.map((n) => (
        <div
          key={n.id}
          className="border-b border-l-4 border-l-brand-accent bg-card text-card-foreground"
        >
          <div className="mx-auto flex max-w-5xl items-start gap-2 pl-4">
            <p className="flex-1 py-3 whitespace-pre-line">{n.message}</p>
            <button
              type="button"
              aria-label={t("Dismiss")}
              onClick={() => dismiss(n.id)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
