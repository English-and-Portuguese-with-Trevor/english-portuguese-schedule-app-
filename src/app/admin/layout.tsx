import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSiteLanguage } from "@/i18n/server";
import { TimezoneSync } from "@/components/timezone-sync";
import { unreadAlertCount } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
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
    .select(
      "role, full_name, email, timezone, theme, learning_language, site_language",
    )
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return (
    <AppShell
      role={"admin"}
      fullName={profile.full_name}
      email={profile.email}
      theme={profile.theme}
      learningLanguage={profile.learning_language}
      siteLanguage={await getSiteLanguage(profile.site_language)}
      profileSiteLanguage={profile.site_language}
      unreadAlerts={await unreadAlertCount(supabase, "admin")}
    >
      <TimezoneSync saved={profile.timezone} />
      {children}
    </AppShell>
  );
}
