import { formatInTimeZone } from "date-fns-tz";

import { sendFlagDigest } from "@/lib/admin-push";
import { hasBearer } from "@/lib/bearer";

// Vercel Cron calls this at 12:30 and 13:30 UTC with "Authorization: Bearer
// <CRON_SECRET>"; only the call that lands at 6 AM in Denver (summer or
// winter time) emails the flagged classes, so the email comes at 6:30 AM.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!hasBearer(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (formatInTimeZone(new Date(), "America/Denver", "H") !== "6") {
    return Response.json({ skipped: "not 6 AM in Denver" });
  }
  try {
    return Response.json(await sendFlagDigest(secret));
  } catch (error) {
    console.error("[flags] failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
