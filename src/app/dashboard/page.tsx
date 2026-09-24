import { addDays, format } from "date-fns";

import { BookingBoard } from "@/components/booking-board";
import { generateCandidateSlots, markOpenSlots } from "@/lib/slots";
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
  const { data: activeBookings } = allSlotIds.length
    ? await supabase
        .from("bookings")
        .select("session_slot_id")
        .in("session_slot_id", allSlotIds)
        .neq("status", "CANCELLED")
    : { data: [] as { session_slot_id: string }[] };

  const bookingCountBySlot: Record<string, number> = {};
  for (const b of activeBookings ?? []) {
    bookingCountBySlot[b.session_slot_id] = (bookingCountBySlot[b.session_slot_id] ?? 0) + 1;
  }

  const candidates = generateCandidateSlots((rules ?? []) as AvailabilityRule[], {
    fromDate: format(now, "yyyy-MM-dd"),
    days: LOOKAHEAD_DAYS,
    now,
  });

  const openIndividualSlots = markOpenSlots(
    candidates,
    (individualSlots ?? []) as SessionSlot[],
    bookingCountBySlot,
  );

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
      openSlots={openIndividualSlots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        bookable: s.bookable,
      }))}
      openClasses={openClasses}
      myBookings={(myBookings ?? []) as unknown as (Booking & {
        session_slots: { start_time: string; end_time: string; type: string; recurring_groups: { title: string } | null } | null;
      })[]}
    />
  );
}
