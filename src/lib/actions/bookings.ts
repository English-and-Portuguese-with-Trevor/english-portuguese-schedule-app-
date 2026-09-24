"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23P01") return "That time was just taken. Please pick another.";
  if (error.code === "23505") return "You're already booked into this.";
  if (error.message.includes("capacity")) return "That class just filled up.";
  return error.message;
}

/**
 * Student (or admin) requests an individual 1:1 slot. Students go through
 * the request_individual_booking DB function, which re-checks the 72h
 * cutoff and availability window server-side and can only create PENDING
 * requests. Admins write directly and are auto-confirmed.
 */
export async function requestBooking(startIso: string, endIso: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  if (profile.role === "admin") {
    const result = await bookIndividualSlot(supabase, {
      start: new Date(startIso),
      end: new Date(endIso),
      studentId: profile.id,
      status: "CONFIRMED",
      isAdminOverride: true,
      createdBy: profile.id,
    });
    if (result.error) return result;
  } else {
    const { error } = await supabase.rpc("request_individual_booking", {
      p_start: startIso,
      p_end: endIso,
    });
    if (error) return { error: friendlyDbError(error) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/bookings");
  return { error: null };
}

/** Join a recurring class instance (session_slot already exists, capacity > 1). */
export async function requestClassBooking(sessionSlotId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  const { error } =
    profile.role === "admin"
      ? await supabase.from("bookings").insert({
          session_slot_id: sessionSlotId,
          student_id: profile.id,
          status: "CONFIRMED",
          is_admin_override: true,
        })
      : await supabase.rpc("request_class_booking", { p_slot_id: sessionSlotId });

  if (error) return { error: friendlyDbError(error) };

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

  const { error } =
    profile.role === "admin"
      ? await supabase
          .from("bookings")
          .update({
            status: "CANCELLED",
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason ?? null,
          })
          .eq("id", bookingId)
      : await supabase.rpc("cancel_my_booking", { p_booking_id: bookingId });

  if (error) return { error: friendlyDbError(error) };

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
