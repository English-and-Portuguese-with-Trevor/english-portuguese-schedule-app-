import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ count: pendingCount }, { count: upcomingCount }, { count: studentCount }] =
    await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
      supabase
        .from("bookings")
        .select("id, session_slots!inner(start_time)", { count: "exact", head: true })
        .neq("status", "CANCELLED")
        .gte("session_slots.start_time", now),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
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
        <p className="text-sm text-muted-foreground">Manage availability, classes, and bookings.</p>
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
    </div>
  );
}
