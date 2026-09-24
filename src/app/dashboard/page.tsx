import { addDays } from "date-fns";

import { BookingBoard } from "@/components/booking-board";
import { getDisplayNames } from "@/lib/display-names";
import { generateUpcomingSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule, Booking, Role } from "@/lib/types";

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

  const [{ data: rules }, { data: slots }, { data: myBookings }] = await Promise.all([
    supabase.from("availability_rules").select("*").eq("is_active", true),
    supabase
      .from("session_slots")
      .select("*")
      .eq("status", "OPEN")
      .gt("end_time", now.toISOString()) // include a session already in progress
      .lte("start_time", rangeEnd.toISOString()),
    supabase
      .from("bookings")
      .select("*, session_slots(start_time, end_time)")
      .eq("student_id", profile!.id)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false }),
  ]);

  // Only admins see who booked a slot; students can't read other students'
  // bookings at all.
  const studentBySlot = new Map<string, string>();
  if (isAdmin && slots?.length) {
    const [{ data: activeBookings }, displayNames] = await Promise.all([
      supabase
        .from("bookings")
        .select("session_slot_id, student_id")
        .in("session_slot_id", slots.map((s) => s.id))
        .neq("status", "CANCELLED"),
      getDisplayNames(supabase),
    ]);
    for (const b of activeBookings ?? []) studentBySlot.set(b.session_slot_id, displayNames[b.student_id]);
  }

  // All candidate start times within active windows, including ones that
  // overlap a booking — the picker shows those struck through.
  const candidates = generateUpcomingSlots((rules ?? []) as AvailabilityRule[], {
    now,
    days: LOOKAHEAD_DAYS,
  });

  // Every OPEN slot is taken: cancelling a booking cancels its slot, so a
  // slot only stays OPEN while it has an active booking.
  const busySlots = (slots ?? []).map((s) => ({
    start: s.start_time,
    end: s.end_time,
    studentName: studentBySlot.get(s.id),
  }));

  return (
    <BookingBoard
      role={profile!.role as Role}
      candidates={candidates.map((c) => ({
        start: c.start.toISOString(),
        end: c.end.toISOString(),
        needsApproval: c.needsApproval,
      }))}
      busySlots={busySlots}
      myBookings={(myBookings ?? []) as (Booking & {
        session_slots: { start_time: string; end_time: string } | null;
      })[]}
    />
  );
}
