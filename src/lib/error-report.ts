"use client";

import { loadClient } from "@/lib/supabase/load-client";

// Error reports: an error nothing caught on a page is sent to Trevor's admin
// dashboard (Errors screen, landing repo) through the report_client_error RPC
// (landing repo's supabase/migrations/20261003000100_client_errors.sql), like
// every other site's errorReport.js. At most 5 a page load, one per message,
// and every failure is ignored: the student never sees a thing.
const MAX_REPORTS = 5;

type Reportable = { message?: unknown; stack?: unknown } | null | undefined;
type Rpc = { rpc: (name: string, args: Record<string, string>) => unknown };

export function makeErrorReporter(site: string, loadSupabase: () => Rpc | Promise<Rpc>, target: Window = window) {
  const sent = new Set<string>();
  return function report(error: unknown, fallback?: string) {
    try {
      const e = (typeof error === "object" ? error : null) as Reportable;
      const message = String(e?.message || fallback || error || "").slice(0, 500);
      if (!message || sent.has(message) || sent.size >= MAX_REPORTS) return;
      sent.add(message);
      Promise.resolve()
        .then(loadSupabase)
        .then((supabase) =>
          supabase.rpc("report_client_error", {
            p_site: site,
            p_message: message,
            p_stack: String(e?.stack || "").slice(0, 4000),
            p_url: String(target.location?.href || "").slice(0, 500),
            p_user_agent: String(target.navigator?.userAgent || "").slice(0, 300),
          }),
        )
        .catch(() => {});
    } catch {
      // A report must never cause an error of its own.
    }
  };
}

let report: ReturnType<typeof makeErrorReporter> | null = null;

/** Starts listening once per page load (AppShell and the error pages call it); returns the reporter. */
export function startErrorReports() {
  if (!report) {
    // The RPC isn't in database.types.ts (it's the landing repo's), hence the cast.
    report = makeErrorReporter("schedule", () => loadClient() as unknown as Promise<Rpc>);
    const send = report;
    window.addEventListener("error", (event) => send(event.error, event.message));
    window.addEventListener("unhandledrejection", (event) => send(event.reason));
  }
  return report;
}

/**
 * For the error pages: React caught the error, so the window never hears of
 * it. A server error's message is generic in production; its digest matches
 * Vercel's logs and keeps different ones apart.
 */
export function reportCaught(error: Error & { digest?: string }) {
  startErrorReports()({ message: error.digest ? `${error.message} (digest ${error.digest})` : error.message, stack: error.stack });
}
