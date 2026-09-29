import { subDays } from "date-fns";

import { BookingsManager } from "@/components/admin/bookings-manager";
import { getDisplayNames } from "@/lib/display-names";
import { createClient } from "@/lib/supabase/server";
import { LATE_CANCEL_LIST_DAYS } from "@/lib/types";

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const now = new Date();
  const lateSince = subDays(now, LATE_CANCEL_LIST_DAYS).toISOString();

  const [{ data: bookings }, { data: lateCancellations }, { data: students }, displayNames] =
    await Promise.all([
      // Upcoming only (a class in progress included): a request for a time
      // that has passed can't be approved any more, and a finished class
      // needs no canceling.
      supabase
        .from("bookings")
        .select("*, session_slots!inner(start_time, end_time)")
        .neq("status", "CANCELLED")
        .gt("session_slots.end_time", now.toISOString()),
      supabase
        .from("bookings")
        .select("id, student_id, cancelled_at, session_slots(start_time)")
        .eq("late_cancellation", true)
        .gte("cancelled_at", lateSince)
        .order("cancelled_at", { ascending: false }),
      supabase.from("profiles").select("id").eq("role", "student"),
      getDisplayNames(supabase),
    ]);

  const studentOptions = (students ?? [])
    .map((s) => ({ id: s.id, name: displayNames[s.id] ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const upcoming = (bookings ?? []).sort((a, b) =>
    a.session_slots.start_time.localeCompare(b.session_slots.start_time),
  );

  return (
    <BookingsManager
      initialBookings={upcoming}
      lateCancellations={lateCancellations ?? []}
      students={studentOptions}
      displayNames={displayNames}
    />
  );
}
