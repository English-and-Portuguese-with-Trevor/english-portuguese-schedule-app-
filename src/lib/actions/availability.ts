"use server";

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

  return supabase;
}

export async function createAvailabilityRule(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  timezone: string;
}): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("availability_rules").insert({
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    slot_duration_minutes: input.slotDurationMinutes,
    timezone: input.timezone,
    created_by: user!.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function toggleAvailabilityRule(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await requireAdmin();
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
  const supabase = await requireAdmin();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard");
  return { error: null };
}
