import { addDays, format, subDays } from "date-fns";
import { z } from "zod";

import { cancelBooking, moveBooking } from "@/lib/actions/bookings";
import { generateUpcomingSlots, markOpenSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import {
  NEW_STUDENT_CLASS_MINUTES,
  isClassStudent,
  type AvailabilityRule,
} from "@/lib/types";

// The main site's header menu (englishandportuguesewithtrevor.com, the
// landing repo's NavMenu.jsx and NavDrawer.jsx) lets a logged-in student
// see the next free times, move a class or cancel one without leaving the
// page. The login cookie is shared across the domain; the main site's
// origin is the only one allowed to call this from a browser. Free times
// are times only, never who holds a taken one, and only for a logged-in
// account. Emails and calendar invites keep coming from here, through the
// same actions the dashboard uses.
const SITE_ORIGIN = "https://englishandportuguesewithtrevor.com";

const CORS = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

/** How far ahead free times are listed (the dashboard shows 14 days; classes can be booked 60 ahead). */
const MAX_DAYS = 28;

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("free-slots"),
    days: z.number().int().min(1).max(MAX_DAYS).optional(),
  }),
  z.object({
    action: z.literal("move"),
    bookingId: z.string(),
    start: z.string(),
    end: z.string(),
    timezone: z.string().nullish(),
  }),
  z.object({
    action: z.literal("cancel"),
    bookingId: z.string(),
    reason: z.string().nullish(),
  }),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== SITE_ORIGIN)
    return json({ error: "Wrong origin." }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Not signed in." }, 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request." }, 400);
  const body = parsed.data;

  try {
    switch (body.action) {
      case "free-slots": {
        const days = body.days ?? 14;
        const now = new Date();
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, lesson_access, class_package")
          .eq("id", user.id)
          .single();
        const shortClasses =
          profile?.role !== "admin" &&
          !isClassStudent(
            profile ?? { lesson_access: "none", class_package: null },
          );
        const [{ data: rules }, { data: slots }, { data: daysOff }] =
          await Promise.all([
            supabase
              .from("availability_rules")
              .select("*")
              .eq("is_active", true),
            supabase
              .from("session_slots")
              .select("id, start_time, end_time, status")
              .eq("status", "OPEN")
              .gt("end_time", now.toISOString())
              .lte("start_time", addDays(now, days).toISOString()),
            supabase
              .from("availability_blocks")
              .select("starts_on, ends_on")
              .gte("ends_on", format(subDays(now, 1), "yyyy-MM-dd")),
          ]);
        const candidates = generateUpcomingSlots(
          (rules ?? []) as AvailabilityRule[],
          {
            now,
            days,
            minutes: shortClasses ? NEW_STUDENT_CLASS_MINUTES : undefined,
            daysOff: daysOff ?? [],
          },
        );
        // Every OPEN slot is taken (canceling a booking cancels its slot), so
        // each one counts as booked without reading whose it is.
        const taken = Object.fromEntries((slots ?? []).map((s) => [s.id, 1]));
        const open = markOpenSlots(
          candidates,
          (slots ?? []) as Parameters<typeof markOpenSlots>[1],
          taken,
        );
        return json({
          slots: open.map((s) => ({
            start: s.start.toISOString(),
            end: s.end.toISOString(),
            needsApproval: s.needsApproval,
          })),
        });
      }
      case "move": {
        const start = new Date(body.start);
        const end = new Date(body.end);
        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(end.getTime()) ||
          end <= start
        )
          return json({ error: "Bad time." }, 400);
        return json(
          await moveBooking(
            body.bookingId,
            start.toISOString(),
            end.toISOString(),
            body.timezone ?? undefined,
          ),
        );
      }
      case "cancel":
        return json(
          await cancelBooking(body.bookingId, body.reason || undefined),
        );
    }
  } catch (error) {
    console.error("[api/student] failed:", error);
    return json({ error: "Something went wrong. Try again in a minute." }, 500);
  }
}
