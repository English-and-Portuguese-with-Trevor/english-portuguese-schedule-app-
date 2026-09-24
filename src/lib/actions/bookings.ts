"use server";

import { addMinutes, format, isBefore } from "date-fns";
import { revalidatePath } from "next/cache";

import { generateCandidateSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_CUTOFF_HOURS } from "@/lib/types";

type ActionResult = { error: string | null };

async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error("Profile not found");

  return { supabase, profile };
}

/**
 * Student (or admin) requests an individual 1:1 slot. Enforces the 72h
 * cutoff for students; admins bypass it and are auto-confirmed.
 */
export async function requestBooking(startIso: string, endIso: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();
  const isAdmin = profile.role === "admin";

  const start = new Date(startIso);
  const end = new Date(endIso);
  const now = new Date();

  if (!isAdmin) {
    const cutoff = addMinutes(now, BOOKING_CUTOFF_HOURS * 60);
    if (isBefore(start, cutoff)) {
      return {
        error: `Sessions must be requested at least ${BOOKING_CUTOFF_HOURS} hours in advance.`,
      };
    }
  }

  // Confirm the slot lines up with an active availability window (admins may
  // override this to hand-place a student into a non-standard time).
  if (!isAdmin) {
    const { data: rules } = await supabase
      .from("availability_rules")
      .select("*")
      .eq("is_active", true);

    const candidates = generateCandidateSlots(rules ?? [], {
      fromDate: format(start, "yyyy-MM-dd"),
      days: 1,
      now: new Date(0),
    });

    const matches = candidates.some(
      (c) => c.start.getTime() === start.getTime() && c.end.getTime() === end.getTime(),
    );
    if (!matches) {
      return { error: "That slot is no longer available." };
    }
  }

  let slotId: string;
  const { data: existingSlot } = await supabase
    .from("session_slots")
    .select("id")
    .eq("start_time", start.toISOString())
    .eq("type", "INDIVIDUAL")
    .maybeSingle();

  if (existingSlot) {
    slotId = existingSlot.id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("session_slots")
      .insert({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        type: "INDIVIDUAL",
        max_capacity: 1,
        status: "OPEN",
        created_by: isAdmin ? profile.id : null,
      })
      .select("id")
      .single();

    if (createErr) {
      const { data: raceSlot } = await supabase
        .from("session_slots")
        .select("id")
        .eq("start_time", start.toISOString())
        .eq("type", "INDIVIDUAL")
        .maybeSingle();
      if (!raceSlot) return { error: "Could not reserve that slot. Please try again." };
      slotId = raceSlot.id;
    } else {
      slotId = created.id;
    }
  }

  const { error: bookingErr } = await supabase.from("bookings").insert({
    session_slot_id: slotId,
    student_id: profile.id,
    status: isAdmin ? "CONFIRMED" : "PENDING",
    is_admin_override: isAdmin,
  });

  if (bookingErr) {
    const message = bookingErr.message.includes("capacity")
      ? "That slot was just booked by someone else."
      : bookingErr.message.includes("duplicate")
        ? "You've already requested this slot."
        : bookingErr.message;
    return { error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/bookings");
  return { error: null };
}

/** Join a recurring class instance (session_slot already exists, capacity > 1). */
export async function requestClassBooking(sessionSlotId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  const { data: slot } = await supabase
    .from("session_slots")
    .select("*")
    .eq("id", sessionSlotId)
    .single();

  if (!slot || slot.status !== "OPEN") {
    return { error: "That class is no longer available." };
  }

  if (profile.role !== "admin") {
    const cutoff = addMinutes(new Date(), BOOKING_CUTOFF_HOURS * 60);
    if (isBefore(new Date(slot.start_time), cutoff)) {
      return {
        error: `Classes must be requested at least ${BOOKING_CUTOFF_HOURS} hours in advance.`,
      };
    }
  }

  const { error } = await supabase.from("bookings").insert({
    session_slot_id: slot.id,
    student_id: profile.id,
    status: profile.role === "admin" ? "CONFIRMED" : "PENDING",
    is_admin_override: profile.role === "admin",
  });

  if (error) {
    const message = error.message.includes("capacity")
      ? "That class just filled up."
      : error.message.includes("duplicate")
        ? "You're already booked into this class."
        : error.message;
    return { error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/bookings");
  return { error: null };
}

/** Admin-only: place a student into a slot directly, bypassing the 72h cutoff. */
export async function adminBookStudent(
  studentId: string,
  startIso: string,
  endIso: string,
): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") return { error: "Admin only." };

  const start = new Date(startIso);
  const end = new Date(endIso);

  let slotId: string;
  const { data: existingSlot } = await supabase
    .from("session_slots")
    .select("id")
    .eq("start_time", start.toISOString())
    .eq("type", "INDIVIDUAL")
    .maybeSingle();

  if (existingSlot) {
    slotId = existingSlot.id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("session_slots")
      .insert({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        type: "INDIVIDUAL",
        max_capacity: 1,
        status: "OPEN",
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (createErr) return { error: createErr.message };
    slotId = created.id;
  }

  const { error } = await supabase.from("bookings").insert({
    session_slot_id: slotId,
    student_id: studentId,
    status: "CONFIRMED",
    is_admin_override: true,
  });

  if (error) {
    const message = error.message.includes("capacity")
      ? "That slot is already taken."
      : error.message.includes("duplicate")
        ? "That student is already booked into this slot."
        : error.message;
    return { error: message };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  const { data: booking } = await supabase
    .from("bookings")
    .select("student_id")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found." };
  if (booking.student_id !== profile.id && profile.role !== "admin") {
    return { error: "You can only cancel your own bookings." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "CANCELLED",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason ?? null,
    })
    .eq("id", bookingId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/admin/bookings");
  return { error: null };
}

/** Admin-only: confirm a pending booking. */
export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") return { error: "Admin only." };

  const { error } = await supabase
    .from("bookings")
    .update({ status: "CONFIRMED" })
    .eq("id", bookingId);

  if (error) return { error: error.message };

  revalidatePath("/admin/bookings");
  return { error: null };
}
