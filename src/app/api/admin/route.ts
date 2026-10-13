import { z } from "zod";

import { sendTestPush } from "@/lib/admin-push";
import { adminBookSeries, adminBookStudent, cancelBooking, confirmBooking } from "@/lib/actions/bookings";
import { checkAdmin } from "@/lib/auth/require-admin";
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

/** The most classes one series can book (adminBookSeries checks it too). */
const MAX_SERIES = 26;

const Slot = z.object({ start: z.string(), end: z.string() });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), bookingId: z.string() }),
  z.object({ action: z.literal("cancel"), bookingId: z.string(), reason: z.string().nullish() }),
  z.object({ action: z.literal("book"), studentId: z.string(), start: z.string(), end: z.string() }),
  z.object({ action: z.literal("book-series"), studentId: z.string(), slots: z.array(Slot) }),
  z.object({ action: z.literal("test-push"), endpoint: z.string(), title: z.string().nullish(), body: z.string() }),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== DASHBOARD_ORIGIN) return json({ error: "Wrong origin." }, 403);

  const admin = await checkAdmin(await createClient());
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  // An unknown action, a missing field or a body that isn't an object all end here.
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request." }, 400);
  const body = parsed.data;

  try {
    switch (body.action) {
      case "confirm":
        return json(await confirmBooking(body.bookingId));
      case "cancel":
        return json(await cancelBooking(body.bookingId, body.reason || undefined));
      case "book": {
        const start = new Date(body.start);
        const end = new Date(body.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
          return json({ error: "Bad time." }, 400);
        }
        return json(await adminBookStudent(body.studentId, start.toISOString(), end.toISOString()));
      }
      case "book-series": {
        const { slots } = body;
        if (slots.length < 1 || slots.length > MAX_SERIES) return json({ error: `Book between 1 and ${MAX_SERIES} classes at a time.` }, 400);
        const clean = [];
        for (const slot of slots) {
          const start = new Date(slot.start);
          const end = new Date(slot.end);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return json({ error: "Bad time." }, 400);
          clean.push({ start: start.toISOString(), end: end.toISOString() });
        }
        return json(await adminBookSeries(body.studentId, clean));
      }
      case "test-push": {
        const secret = process.env.CRON_SECRET;
        if (!secret) return json({ error: "Push isn't set up on the server (CRON_SECRET is missing)." }, 500);
        const title = (body.title ?? "").trim().slice(0, 80) || "Test notification";
        const text = body.body.trim().slice(0, 300);
        if (!text) return json({ error: "Type a message first." }, 400);
        return json(await sendTestPush(secret, body.endpoint, title, text));
      }
    }
  } catch (error) {
    // The details go to the function logs; the caller gets a plain line.
    console.error("[api/admin] failed:", error);
    return json({ error: "Something went wrong. Try again in a minute." }, 500);
  }
}
