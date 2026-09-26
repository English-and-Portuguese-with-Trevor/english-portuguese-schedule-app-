import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkGoogleConnection } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ count: pendingCount }, { count: upcomingCount }, { count: studentCount }, google, { data: lastProblem }] =
    await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
      supabase
        .from("bookings")
        .select("id, session_slots!inner(start_time)", { count: "exact", head: true })
        .neq("status", "CANCELLED")
        .gte("session_slots.start_time", now),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
      checkGoogleConnection(),
      supabase.from("integration_status").select("ok, message, checked_at").eq("service", "google").maybeSingle(),
    ]);

  const stats = [
    { label: "Pending requests", value: pendingCount ?? 0, href: "/admin/bookings" },
    { label: "Upcoming sessions", value: upcomingCount ?? 0, href: "/admin/bookings" },
    { label: "Students", value: studentCount ?? 0, href: "/admin/users" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin overview</h1>
        <p className="text-sm text-muted-foreground">Manage availability and bookings.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Google (Meet links and emails)</h2>
        <p className={google.ok ? "mt-1 text-sm text-emerald-700 dark:text-emerald-400" : "mt-1 text-sm text-destructive"}>
          {google.ok ? "✓ " : "✗ "}
          {google.message}
        </p>
        {lastProblem && !lastProblem.ok && (
          <p className="mt-2 text-sm text-muted-foreground">
            Last problem, {formatDistanceToNowStrict(new Date(lastProblem.checked_at))} ago: {lastProblem.message}
          </p>
        )}
        {!google.ok && (
          <p className="mt-2 text-sm text-muted-foreground">
            Bookings still work, but no invites, Meet links, or emails go out until this is fixed. The README
            explains how to create a new refresh token.
          </p>
        )}
      </section>
    </div>
  );
}
