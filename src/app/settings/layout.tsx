import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSiteLanguage } from "@/i18n/server";
import { unreadAlertCount } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, theme, learning_language, site_language, start_page, class_package, notes_access")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <AppShell
      role={profile.role as Role}
      fullName={profile.full_name}
      email={profile.email}
      theme={profile.theme}
      learningLanguage={profile.learning_language}
      startPage={profile.start_page}
      classPackage={profile.class_package}
      notesAccess={profile.notes_access}
      siteLanguage={await getSiteLanguage(profile.site_language)}
      profileSiteLanguage={profile.site_language}
      unreadAlerts={await unreadAlertCount(supabase, profile.role)}
    >
      {children}
    </AppShell>
  );
}
