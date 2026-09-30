import { adminBookStudent, cancelBooking, confirmBooking } from "@/lib/actions/bookings";
import { createClient } from "@/lib/supabase/server";

// The admin dashboard on the landing site (englishandportuguesewithtrevor.com/admin/)
// approves, cancels and books classes through this route, so the emails and
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
  | { action: "book"; studentId: string; start: string; end: string };

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
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    console.error("[api/admin] failed:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
