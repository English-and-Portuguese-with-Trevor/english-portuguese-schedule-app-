"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";

type ActionResult = { error: string | null };


export async function createAvailabilityRule(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  timezone: string;
}): Promise<ActionResult> {
  if (!Intl.supportedValuesOf("timeZone").includes(input.timezone)) {
    return { error: "Pick a time zone from the list." };
  }
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("availability_rules").insert({
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    slot_duration_minutes: input.slotDurationMinutes,
    timezone: input.timezone,
    created_by: adminId,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function toggleAvailabilityRule(id: string, isActive: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("availability_rules")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteAvailabilityRule(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}

/** Days off (`availability_blocks`): no class can be booked on these dates. */
export async function addDayOff(startsOn: string, endsOn: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { error: "Pick a date." };
  }
  if (endsOn < startsOn) return { error: "The last day can't be before the first." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("availability_blocks")
    .insert({ starts_on: startsOn, ends_on: endsOn });

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDayOff(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("availability_blocks").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}
