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
 * Creates a new individual session slot and books it in one go. Always
 * inserts a fresh session_slots row — individual sessions never share a
 * slot — and relies on the DB's overlap exclusion constraint as the final
 * race-condition guard (two overlapping 15-minute-aligned start times, e.g.
 * 2:00 and 2:15, could otherwise both slip through a naive check-then-insert).
 */
async function bookIndividualSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    start: Date;
    end: Date;
    studentId: string;
    status: "PENDING" | "CONFIRMED";
    isAdminOverride: boolean;
    createdBy: string | null;
  },
): Promise<ActionResult> {
  const { start, end, studentId, status, isAdminOverride, createdBy } = params;

  // Soft pre-check for a friendly message; the exclusion constraint below is
  // the actual guarantee against a concurrent conflicting request.
  const { data: overlapping } = await supabase
    .from("session_slots")
    .select("id, bookings!inner(status)")
    .eq("type", "INDIVIDUAL")
    .eq("status", "OPEN")
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .neq("bookings.status", "CANCELLED")
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return { error: "That time overlaps an existing session. Please pick another time." };
  }

  const { data: slot, error: slotErr } = await supabase
    .from("session_slots")
    .insert({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      type: "INDIVIDUAL",
      max_capacity: 1,
      status: "OPEN",
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (slotErr) {
    const message = slotErr.code === "23P01" ? "That time was just taken. Please pick another." : slotErr.message;
    return { error: message };
  }

  const { error: bookingErr } = await supabase.from("bookings").insert({
    session_slot_id: slot.id,
    student_id: studentId,
    status,
    is_admin_override: isAdminOverride,
  });

  if (bookingErr) {
    return { error: bookingErr.message };
  }

  return { error: null };
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

  const result = await bookIndividualSlot(supabase, {
    start,
    end,
    studentId: profile.id,
    status: isAdmin ? "CONFIRMED" : "PENDING",
    isAdminOverride: isAdmin,
    createdBy: isAdmin ? profile.id : null,
  });

  if (result.error) return result;

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

  const result = await bookIndividualSlot(supabase, {
    start,
    end,
    studentId,
    status: "CONFIRMED",
    isAdminOverride: true,
    createdBy: profile.id,
  });

  if (result.error) return result;

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
