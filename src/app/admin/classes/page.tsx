import { ClassesManager } from "@/components/admin/classes-manager";
import { createClient } from "@/lib/supabase/server";
import type { RecurringGroup } from "@/lib/types";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("recurring_groups")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: instances } = await supabase
    .from("session_slots")
    .select("id, start_time, end_time, status, recurring_group_id")
    .eq("type", "RECURRING_CLASS")
    .gte("start_time", new Date().toISOString())
    .order("start_time");

  return (
    <ClassesManager
      initialGroups={(groups ?? []) as RecurringGroup[]}
      instances={instances ?? []}
    />
  );
}
