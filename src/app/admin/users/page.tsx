import { UsersManager } from "@/components/admin/users-manager";
import { getDisplayNames } from "@/lib/display-names";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function UsersPage() {
  const supabase = await createClient();
  const [{ data: users }, displayNames] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50),
    getDisplayNames(supabase),
  ]);

  return <UsersManager initialUsers={(users ?? []) as Profile[]} displayNames={displayNames} />;
}
