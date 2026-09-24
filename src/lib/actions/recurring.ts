"use server";

import { addDays, addMinutes, format, isAfter } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  return { supabase, adminId: user.id };
}

export async function createRecurringClass(input: {
  title: string;
  description?: string;
  dayOfWeek: number;
  startTime: string; // "HH:mm:ss"
  durationMinutes: number;
  timezone: string;
  startsOn: string; // "yyyy-MM-dd"
  endsOn: string; // "yyyy-MM-dd"
  maxCapacity: number;
}): Promise<ActionResult> {
  const { supabase, adminId } = await requireAdmin();

  const { data: group, error: groupErr } = await supabase
    .from("recurring_groups")
    .insert({
      title: input.title,
      description: input.description ?? null,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      timezone: input.timezone,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      max_capacity: input.maxCapacity,
      created_by: adminId,
    })
    .select("id")
    .single();

  if (groupErr || !group) return { error: groupErr?.message ?? "Failed to create class." };

  // Generate one SessionSlot per week the class runs.
  let cursorDate = new Date(`${input.startsOn}T00:00:00`);
  const endDate = new Date(`${input.endsOn}T00:00:00`);
  while (cursorDate.getDay() !== input.dayOfWeek) {
    cursorDate = addDays(cursorDate, 1);
  }

  const instances: { start_time: string; end_time: string; type: string; max_capacity: number; recurring_group_id: string }[] = [];
  while (!isAfter(cursorDate, endDate)) {
    const dateStr = format(cursorDate, "yyyy-MM-dd");
    const start = fromZonedTime(`${dateStr}T${input.startTime}`, input.timezone);
    const end = addMinutes(start, input.durationMinutes);
    instances.push({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      type: "RECURRING_CLASS",
      max_capacity: input.maxCapacity,
      recurring_group_id: group.id,
    });
    cursorDate = addDays(cursorDate, 7);
  }

  if (instances.length > 0) {
    const { error: slotsErr } = await supabase.from("session_slots").insert(instances);
    if (slotsErr) return { error: slotsErr.message };
  }

  revalidatePath("/admin/classes");
  revalidatePath("/dashboard");
  return { error: null };
}

/** Cancel a single occurrence without touching the rest of the series. */
export async function cancelRecurringInstance(sessionSlotId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("session_slots")
    .update({ status: "CANCELLED" })
    .eq("id", sessionSlotId);

  if (error) return { error: error.message };

  await supabase
    .from("bookings")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("session_slot_id", sessionSlotId)
    .neq("status", "CANCELLED");

  revalidatePath("/admin/classes");
  revalidatePath("/dashboard");
  return { error: null };
}

/** Cancel the whole series: deactivate the group and cancel all future open instances. */
export async function cancelRecurringSeries(groupId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error: groupErr } = await supabase
    .from("recurring_groups")
    .update({ is_active: false })
    .eq("id", groupId);
  if (groupErr) return { error: groupErr.message };

  const { data: futureSlots, error: slotsErr } = await supabase
    .from("session_slots")
    .select("id")
    .eq("recurring_group_id", groupId)
    .eq("status", "OPEN")
    .gt("start_time", new Date().toISOString());
  if (slotsErr) return { error: slotsErr.message };

  const slotIds = (futureSlots ?? []).map((s) => s.id);
  if (slotIds.length > 0) {
    await supabase.from("session_slots").update({ status: "CANCELLED" }).in("id", slotIds);
    await supabase
      .from("bookings")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .in("session_slot_id", slotIds)
      .neq("status", "CANCELLED");
  }

  revalidatePath("/admin/classes");
  revalidatePath("/dashboard");
  return { error: null };
}
