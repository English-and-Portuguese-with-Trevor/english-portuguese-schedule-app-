import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  // During an update every page shows /maintenance with a 503, so visitors see
  // a notice instead of an error. Set MAINTENANCE_MODE=on in Vercel to turn it on.
  // The CRON_SECRET routes (reminders, alert pushes) keep running.
  const { pathname } = request.nextUrl;
  const isJob = pathname.startsWith("/api/cron/") || pathname === "/api/alerts/push";
  if (process.env.MAINTENANCE_MODE === "on" && !isJob) {
    return NextResponse.rewrite(new URL("/maintenance", request.url), {
      status: 503,
      headers: { "Retry-After": "300" },
    });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
