import { addDays } from "date-fns";

import { AdminCalendar, type CalendarBooking } from "@/components/admin/admin-calendar";
import { parseDateParam, parseView, visibleDays } from "@/lib/calendar";
import { getDisplayNames } from "@/lib/display-names";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule } from "@/lib/types";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const date = typeof params.date === "string" && parseDateParam(params.date) ? params.date : null;

  // The calendar is drawn in this device's time zone, which the server (UTC)
  // doesn't know, and without a date it opens on the device's today. A week
  // either side of the shown days covers any zone's difference.
  const days = visibleDays(view, parseDateParam(date ?? undefined) ?? new Date());
  const from = addDays(days[0], -7).toISOString();
  const to = addDays(days[days.length - 1], 8).toISOString();

  const supabase = await createClient();
  const [{ data: bookings }, { data: rules }, { data: students }, displayNames] = await Promise.all([
    // Past and canceled classes too: the calendar shows everything.
    supabase
      .from("bookings")
      .select(
        "id, student_id, status, is_admin_override, meet_link, reschedule_of, lesson_language, whatsapp, late_cancellation, notes, session_slots!inner(start_time, end_time)",
      )
      .gte("session_slots.start_time", from)
      .lt("session_slots.start_time", to),
    supabase.from("availability_rules").select("*"),
    supabase.from("profiles").select("id").eq("role", "student"),
    getDisplayNames(supabase),
  ]);

  // Where a reschedule request would move a class from (it may be outside
  // the shown dates). A canceled original has no start to show.
  const originalIds = [...new Set((bookings ?? []).flatMap((b) => (b.reschedule_of ? [b.reschedule_of] : [])))];
  const { data: originals } = originalIds.length
    ? await supabase
        .from("bookings")
        .select("id, status, session_slots(start_time)")
        .in("id", originalIds)
    : { data: [] };
  const originalStarts: Record<string, string | null> = {};
  for (const o of originals ?? []) {
    originalStarts[o.id] = o.status === "CANCELLED" ? null : (o.session_slots?.start_time ?? null);
  }

  const studentOptions = (students ?? [])
    .map((s) => ({ id: s.id, name: displayNames[s.id] ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminCalendar
      view={view}
      date={date}
      initialBookings={(bookings ?? []) as CalendarBooking[]}
      originalStarts={originalStarts}
      rules={(rules ?? []) as AvailabilityRule[]}
      students={studentOptions}
      displayNames={displayNames}
    />
  );
}
