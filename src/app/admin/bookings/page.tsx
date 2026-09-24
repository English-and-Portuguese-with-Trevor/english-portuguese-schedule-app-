import { BookingsManager } from "@/components/admin/bookings-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const [{ data: bookings }, { data: students }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "*, profiles!bookings_student_id_fkey(full_name, email), session_slots(start_time, end_time, type, recurring_groups(title))",
      )
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id, full_name, email").eq("role", "student").order("full_name"),
  ]);

  return (
    <BookingsManager
      initialBookings={bookings ?? []}
      students={students ?? []}
    />
  );
}
