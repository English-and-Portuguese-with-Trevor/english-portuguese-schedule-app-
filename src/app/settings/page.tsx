import { AccountSettings } from "@/components/account-settings";
import type { StartPage } from "@/lib/prefs";
import type { ArticleDelivery, ClassUpdateDelivery, SummaryDelivery } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import type { LessonAccess, Role } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: billing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, full_name, email, lesson_access, article_delivery, summary_delivery, class_update_delivery, app_uses, start_page")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("billing")
      .select(
        "status, current_period_end, cancel_at_period_end, subscription_id",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  return (
    <AccountSettings
      name={profile?.full_name ?? null}
      email={profile?.email ?? user!.email ?? null}
      role={(profile?.role ?? "student") as Role}
      lessonAccess={(profile?.lesson_access ?? "none") as LessonAccess}
      billing={billing ?? null}
      articleDelivery={(profile?.article_delivery ?? "app") as ArticleDelivery}
      summaryDelivery={(profile?.summary_delivery ?? "email") as SummaryDelivery}
      classUpdateDelivery={(profile?.class_update_delivery ?? "email") as ClassUpdateDelivery}
      appUses={(profile?.app_uses ?? []) as StartPage[]}
      startPage={(profile?.start_page ?? null) as StartPage | null}
    />
  );
}
