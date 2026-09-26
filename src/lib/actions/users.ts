"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

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

export async function searchUsers(query: string) {
  const supabase = await requireAdmin();
  let builder = supabase.from("profiles").select("*").order("created_at", { ascending: false });

  const trimmed = query.trim();
  if (trimmed) {
    // Strip characters that are structurally significant to PostgREST's
    // filter syntax so a search string can't break out of the `.or()` clause.
    const safe = trimmed.replace(/[,()%*]/g, "");
    if (safe) {
      builder = builder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
  }

  const { data, error } = await builder.limit(50);
  if (error) throw new Error(error.message);
  return data;
}

export async function updateUserRole(userId: string, role: Role): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

export async function setLessonAccess(userId: string, granted: boolean): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ lesson_access: granted ? "granted" : "none" })
    .eq("id", userId)
    .neq("lesson_access", "subscriber");

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}
