import { formatInTimeZone } from "date-fns-tz";

import { AvailabilityManager } from "@/components/admin/availability-manager";
import { DaysOff } from "@/components/admin/days-off";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule } from "@/lib/types";

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const [{ data: rules }, { data: daysOff }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .order("day_of_week")
      .order("start_time"),
    // Upcoming days off: ending today (in Denver) or later.
    supabase
      .from("availability_blocks")
      .select("id, starts_on, ends_on")
      .gte("ends_on", formatInTimeZone(new Date(), "America/Denver", "yyyy-MM-dd"))
      .order("starts_on"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <AvailabilityManager initialRules={(rules ?? []) as AvailabilityRule[]} />
      <DaysOff daysOff={daysOff ?? []} />
    </div>
  );
}
