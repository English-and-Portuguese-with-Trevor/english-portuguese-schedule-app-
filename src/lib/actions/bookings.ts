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
      status: "OPEN",
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (slotErr) return { error: friendlyDbError(slotErr) };

  const { error: bookingErr } = await supabase.from("bookings").insert({
    session_slot_id: slot.id,
    student_id: studentId,
    status,
    is_admin_override: isAdminOverride,
  });

  if (bookingErr) {
    // Don't leave an empty slot behind blocking the time.
    await supabase.from("session_slots").delete().eq("id", slot.id);
    return { error: friendlyDbError(bookingErr) };
  }

  return { error: null };
}

function friendlyDbError(error: { code?: string; message: string }): string {
  // 23P01: overlaps another session; 23505: the slot already has a booking.
  if (error.code === "23P01" || error.code === "23505") return "That time was just taken. Please pick another.";
  return error.message;
}

/**
 * Student (or admin) books a 1:1 slot. Students go through the
 * request_individual_booking DB function, which re-checks the availability
 * window server-side and decides the status: confirmed if the session is at
 * least 72 hours away, pending approval if sooner. Admins write directly and
 * are always confirmed.
 */
export async function requestBooking(
  startIso: string,
  endIso: string,
): Promise<ActionResult & { pending?: boolean }> {
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
    const { data: bookingId, error } = await supabase.rpc("request_individual_booking", {
      p_start: startIso,
      p_end: endIso,
    });
    if (error) return { error: friendlyDbError(error) };

    const { data: booking } = await supabase.from("bookings").select("status").eq("id", bookingId).single();
    revalidatePath("/dashboard");
    revalidatePath("/admin/bookings");
    return { error: null, pending: booking?.status === "PENDING" };
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
