"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import type { ClassPackage, ClassProgress, LessonAccess, Role } from "@/lib/types";

type ActionResult = { error: string | null };


export async function searchUsers(query: string) {
  const { supabase } = await requireAdmin();
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
  const { supabase, adminId } = await requireAdmin();

  if (role !== "admin") {
    // Demoting yourself, or the only admin, would lock everyone out of these pages.
    if (userId === adminId) return { error: "You can't remove your own admin access." };
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("id", userId);
    if (!count) return { error: "There must always be at least one admin." };
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

/** Lesson access Trevor sets by hand. Subscribers can be moved to lifetime (not to plain student access). */
export async function setLessonAccess(
  userId: string,
  access: Exclude<LessonAccess, "subscriber">,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  let update = supabase.from("profiles").update({ lesson_access: access }).eq("id", userId);
  if (access !== "lifetime") update = update.neq("lesson_access", "subscriber");
  const { error } = await update;

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

/** The student's class package and classes taken before the schedule app, for the lifetime-access count. */
export async function setClassTracking(
  userId: string,
  classPackage: ClassPackage | null,
  earlierClasses: number,
): Promise<ActionResult> {
  if (classPackage !== null && classPackage !== 4 && classPackage !== 8) return { error: "Package must be 4 or 8 classes." };
  if (!Number.isInteger(earlierClasses) || earlierClasses < 0 || earlierClasses > 1000) {
    return { error: "Earlier classes must be a whole number from 0 to 1000." };
  }
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ class_package: classPackage, earlier_classes: earlierClasses })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

export async function getClassProgress(): Promise<ClassProgress[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_class_progress");
  if (error) throw new Error(error.message);
  return (data ?? []) as ClassProgress[];
}
