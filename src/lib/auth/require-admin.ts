import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AdminCheck =
  | { ok: true; adminId: string }
  | { ok: false; status: 401 | 403; reason: "signed-out" | "not-admin" | "needs-code"; error: string };

/**
 * The one admin check for every admin server action and route (see CLAUDE.md):
 * an admin profile, and once Trevor has Google Authenticator set up, a session
 * that entered a code (aal2), the same rule as the database's is_admin().
 */
export async function checkAdmin(supabase: Supabase): Promise<AdminCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, reason: "signed-out", error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { ok: false, status: 403, reason: "not-admin", error: "Admin only." };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return {
      ok: false,
      status: 403,
      reason: "needs-code",
      error: "Enter your Google Authenticator code first (reload the admin dashboard).",
    };
  }
  return { ok: true, adminId: user.id };
}

/** For server actions: throws unless checkAdmin passes. */
export async function requireAdmin() {
  const supabase = await createClient();
  const check = await checkAdmin(supabase);
  if (!check.ok) throw new Error(check.error);
  return { supabase, adminId: check.adminId };
}
