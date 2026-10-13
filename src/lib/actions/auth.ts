"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  // "local" ends the login on this device only; the default would sign out every device.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
