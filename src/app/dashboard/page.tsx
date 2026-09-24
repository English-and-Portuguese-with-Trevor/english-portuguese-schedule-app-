import { addDays } from "date-fns";

import { BookingBoard } from "@/components/booking-board";
import { getDisplayNames } from "@/lib/display-names";
import { generateUpcomingSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule, Booking, Role, SessionSlot } from "@/lib/types";

const LOOKAHEAD_DAYS = 21;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user!.id)
    .single();
  const isAdmin = profile!.role === "admin";

  const now = new Date();
  const rangeEnd = addDays(now, LOOKAHEAD_DAYS);

  const [{ data: rules }, { data: individualSlots }, { data: classSlots }, { data: myBookings }] =
    await Promise.all([
      supabase.from("availability_rules").select("*").eq("is_active", true),
      supabase
        .from("session_slots")
        .select("*")
        .eq("type", "INDIVIDUAL")
        .eq("status", "OPEN")
        .gte("start_time", now.toISOString())
        .lte("start_time", rangeEnd.toISOString()),
      supabase
        .from("session_slots")
        .select("*, recurring_groups(title, description)")
        .eq("type", "RECURRING_CLASS")
        .eq("status", "OPEN")
        .gte("start_time", now.toISOString())
        .lte("start_time", rangeEnd.toISOString())
        .order("start_time"),
      supabase
        .from("bookings")
        .select("*, session_slots(start_time, end_time, type, recurring_groups(title))")
        .eq("student_id", profile!.id)
        .neq("status", "CANCELLED")
        .order("created_at", { ascending: false }),
    ]);

  const allSlotIds = [...(individualSlots ?? []), ...(classSlots ?? [])].map((s) => s.id);
  const [{ data: activeBookings }, displayNames] = await Promise.all([
    allSlotIds.length
      ? supabase
          .from("bookings")
          .select("session_slot_id, student_id")
          .in("session_slot_id", allSlotIds)
          .neq("status", "CANCELLED")
      : Promise.resolve({ data: [] as { session_slot_id: string; student_id: string }[] }),
    // Only admins see who booked a given 1:1 slot.
    isAdmin ? getDisplayNames(supabase) : Promise.resolve({} as Record<string, string>),
  ]);

  const bookingCountBySlot: Record<string, number> = {};
  const studentNameBySlot: Record<string, string> = {};
  for (const b of activeBookings ?? []) {
    bookingCountBySlot[b.session_slot_id] = (bookingCountBySlot[b.session_slot_id] ?? 0) + 1;
    if (displayNames[b.student_id]) studentNameBySlot[b.session_slot_id] = displayNames[b.student_id];
  }

  // All candidate start times within active windows, unfiltered by booking
  // status — the calendar needs to render open, cutoff-blocked, AND booked
  // cells, not just what's currently bookable.
  const candidates = generateUpcomingSlots((rules ?? []) as AvailabilityRule[], {
    now,
    days: LOOKAHEAD_DAYS,
  });

  const busySlots = (individualSlots as SessionSlot[] | null ?? [])
    .filter((s) => (bookingCountBySlot[s.id] ?? 0) >= s.max_capacity)
    .map((s) => ({
      start: s.start_time,
      end: s.end_time,
      studentName: isAdmin ? studentNameBySlot[s.id] : undefined,
    }));

  const openClasses = (classSlots ?? [])
    .map((slot) => ({
      id: slot.id,
      startTime: slot.start_time,
      endTime: slot.end_time,
      maxCapacity: slot.max_capacity,
      bookedCount: bookingCountBySlot[slot.id] ?? 0,
      title: (slot as unknown as { recurring_groups: { title: string } | null }).recurring_groups
        ?.title ?? "Class",
    }))
    .filter((c) => c.bookedCount < c.maxCapacity);

  return (
    <BookingBoard
      role={profile!.role as Role}
      candidates={candidates.map((c) => ({
        start: c.start.toISOString(),
        end: c.end.toISOString(),
        bookable: c.bookable,
      }))}
      busySlots={busySlots}
      openClasses={openClasses}
      myBookings={(myBookings ?? []) as unknown as (Booking & {
        session_slots: { start_time: string; end_time: string; type: string; recurring_groups: { title: string } | null } | null;
      })[]}
    />
  );
}
