import { sendAlerts } from "@/lib/admin-push";

// The database calls this (pg_net) right after a new sign-up or subscriber
// alert, with "Authorization: Bearer <CRON_SECRET>", to email and push it.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await sendAlerts(secret));
  } catch (error) {
    console.error("[alerts] failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
