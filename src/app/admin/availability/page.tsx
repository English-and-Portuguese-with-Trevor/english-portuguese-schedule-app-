import { AvailabilityManager } from "@/components/admin/availability-manager";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule } from "@/lib/types";

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("availability_rules")
    .select("*")
    .order("day_of_week")
    .order("start_time");

  return <AvailabilityManager initialRules={(rules ?? []) as AvailabilityRule[]} />;
}
