import { sendTestPush } from "@/lib/admin-push";
import { adminBookSeries, adminBookStudent, cancelBooking, confirmBooking, MAX_SERIES } from "@/lib/actions/bookings";
import { createClient } from "@/lib/supabase/server";

// The admin dashboard on the landing site (englishandportuguesewithtrevor.com/admin/)
// approves, cancels and books classes through this route (and sends a test
// notification to the device it's open on), so the emails and
// calendar invites keep coming from here. The login cookie is shared across
// the domain, so the same session check as the admin pages applies; the
// dashboard's origin is the only one allowed to call it from a browser.
const DASHBOARD_ORIGIN = "https://englishandportuguesewithtrevor.com";

const CORS = {
  "Access-Control-Allow-Origin": DASHBOARD_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

type Body =
  | { action: "confirm"; bookingId: string }
  | { action: "cancel"; bookingId: string; reason?: string }
  | { action: "book"; studentId: string; start: string; end: string }
  | { action: "book-series"; studentId: string; slots: { start: string; end: string }[] }
  | { action: "test-push"; endpoint: string; title?: string; body: string };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== DASHBOARD_ORIGIN) return json({ error: "Wrong origin." }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Not signed in." }, 401);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return json({ error: "Admin only." }, 403);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  try {
    switch (body.action) {
      case "confirm":
        return json(await confirmBooking(String(body.bookingId)));
      case "cancel":
        return json(await cancelBooking(String(body.bookingId), body.reason ? String(body.reason) : undefined));
      case "book": {
        const start = new Date(body.start);
        const end = new Date(body.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
          return json({ error: "Bad time." }, 400);
        }
        return json(await adminBookStudent(String(body.studentId), start.toISOString(), end.toISOString()));
      }
      case "book-series": {
        const slots = Array.isArray(body.slots) ? body.slots : [];
        if (slots.length < 1 || slots.length > MAX_SERIES) return json({ error: `Book between 1 and ${MAX_SERIES} classes at a time.` }, 400);
        const clean = [];
        for (const slot of slots) {
          const start = new Date(slot?.start);
          const end = new Date(slot?.end);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return json({ error: "Bad time." }, 400);
          clean.push({ start: start.toISOString(), end: end.toISOString() });
        }
        return json(await adminBookSeries(String(body.studentId), clean));
      }
      case "test-push": {
        const secret = process.env.CRON_SECRET;
        if (!secret) return json({ error: "Push isn't set up on the server (CRON_SECRET is missing)." }, 500);
        const title = String(body.title ?? "").trim().slice(0, 80) || "Test notification";
        const text = String(body.body ?? "").trim().slice(0, 300);
        if (!text) return json({ error: "Type a message first." }, 400);
        return json(await sendTestPush(secret, String(body.endpoint), title, text));
      }
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    console.error("[api/admin] failed:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
