import { BookingsManager } from "@/components/admin/bookings-manager";
import { getDisplayNames } from "@/lib/display-names";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const [{ data: bookings }, { data: students }, displayNames] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, session_slots(start_time, end_time, type, recurring_groups(title))")
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id").eq("role", "student"),
    getDisplayNames(supabase),
  ]);

  const studentOptions = (students ?? [])
    .map((s) => ({ id: s.id, name: displayNames[s.id] ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <BookingsManager
      initialBookings={bookings ?? []}
      students={studentOptions}
      displayNames={displayNames}
    />
  );
}
