"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/** The student ticks a homework item done, or un-ticks it (mark_homework: their own rows only). */
export async function markHomework(id: string, done: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_homework", { p_id: id, p_done: done });
  if (error) return { error: "Something went wrong. Please try again." };
  revalidatePath("/dashboard");
  return { error: null };
}
