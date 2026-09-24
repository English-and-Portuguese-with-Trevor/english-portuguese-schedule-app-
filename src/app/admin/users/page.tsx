import { UsersManager } from "@/components/admin/users-manager";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return <UsersManager initialUsers={(users ?? []) as Profile[]} />;
}
