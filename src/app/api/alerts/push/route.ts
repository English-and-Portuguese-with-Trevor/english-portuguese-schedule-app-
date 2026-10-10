import { sendAlerts } from "@/lib/admin-push";
import { hasBearer } from "@/lib/bearer";
import { sendWelcomes } from "@/lib/welcome";

// The database calls this (pg_net) right after a new sign-up or subscriber
// alert, with "Authorization: Bearer <CRON_SECRET>", to email and push it
// (and to send a new account its welcome email).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!hasBearer(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const welcomed = await sendWelcomes(secret).catch((error) => {
      console.error("[welcome] failed:", error);
      return 0;
    });
    return Response.json({ ...(await sendAlerts(secret)), welcomed });
  } catch (error) {
    console.error("[alerts] failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
