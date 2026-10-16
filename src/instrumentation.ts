import { createClient } from "@supabase/supabase-js";

// A page or route that throws on the server reaches the browser as "Minified
// React error #441" with only a digest, so the error pages' reports (error.tsx,
// src/lib/error-report.ts) say nothing about what broke. Next calls this with
// the real error: send it to the same place (report_client_error, landing
// repo's admin dashboard, Errors), with the digest so the two reports match.
// The server has no session, so the row shows as logged out. Every failure is
// ignored, like the browser's reports.
export async function onRequestError(
  err: unknown,
  request: { path: string; headers: { [key: string]: string | string[] | undefined } },
) {
  try {
    const e = err as { message?: unknown; stack?: unknown; digest?: unknown } | null;
    const message = `Server: ${String(e?.message || err || "")}${e?.digest ? ` (digest ${e.digest})` : ""}`;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.rpc("report_client_error", {
      p_site: "schedule",
      p_message: message.slice(0, 500),
      p_stack: String(e?.stack || "").slice(0, 4000),
      p_url: `https://schedule.englishandportuguesewithtrevor.com${request.path}`.slice(0, 500),
      p_user_agent: String(request.headers["user-agent"] || "").slice(0, 300),
    });
  } catch {
    // A report must never cause an error of its own.
  }
}
