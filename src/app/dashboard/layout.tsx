import { redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <Nav role={profile.role as Role} fullName={profile.full_name} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
