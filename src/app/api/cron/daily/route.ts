import { hasBearer } from "@/lib/bearer";
import { runDailyJob } from "@/lib/daily-job";

// Vercel Cron calls this once a day with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!hasBearer(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await runDailyJob(secret));
  } catch (error) {
    console.error("[daily-job] failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
