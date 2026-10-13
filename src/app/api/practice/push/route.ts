import { hasBearer } from "@/lib/bearer";
import { sendPracticePushes } from "@/lib/practice-push";

// pg_cron (private.request_practice_pushes) calls this a few minutes past
// every hour, with "Authorization: Bearer <CRON_SECRET>", to send the daily
// practice reminders due that hour.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!hasBearer(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await sendPracticePushes(secret));
  } catch (error) {
    console.error("[practice] failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
