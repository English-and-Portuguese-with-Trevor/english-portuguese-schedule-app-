import { AlertsList } from "@/components/admin/alerts-list";
import type { AlertRow } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("admin_alerts")
    .select("id, kind, name, email, reason, class_start, item, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground">Flagged classes, reported issues, new sign-ups and new subscribers, newest first.</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Push notifications are turned on from the{" "}
        <a className="underline" href="https://englishandportuguesewithtrevor.com/admin/#/alerts">
          admin dashboard
        </a>
        , so each device gets one set.
      </p>
      <AlertsList alerts={(alerts ?? []) as (AlertRow & { read_at: string | null })[]} />
    </div>
  );
}
