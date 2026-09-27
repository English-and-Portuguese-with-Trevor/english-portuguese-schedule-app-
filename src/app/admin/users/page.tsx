import { UsersManager } from "@/components/admin/users-manager";
import { getDisplayNames } from "@/lib/display-names";
import { createClient } from "@/lib/supabase/server";
import type { ClassProgress, Profile } from "@/lib/types";

export default async function UsersPage() {
  const supabase = await createClient();
  const [{ data: users }, displayNames, { data: progressRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      getDisplayNames(supabase),
      supabase.rpc("admin_class_progress"),
    ]);

  const progress = Object.fromEntries(
    ((progressRows ?? []) as ClassProgress[]).map((row) => [row.user_id, row]),
  );

  return (
    <UsersManager
      initialUsers={(users ?? []) as Profile[]}
      displayNames={displayNames}
      progress={progress}
    />
  );
}
