import { AlertsList } from "@/components/admin/alerts-list";
import { PushToggle } from "@/components/admin/push-toggle";
import type { AlertRow } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("admin_alerts")
    .select("id, kind, name, email, reason, class_start, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground">Flagged classes, new sign-ups and new subscribers, newest first.</p>
      </div>
      <PushToggle />
      <AlertsList alerts={(alerts ?? []) as (AlertRow & { read_at: string | null })[]} />
    </div>
  );
}
