"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export function Nav({ role, fullName }: { role: Role; fullName: string | null }) {
  const pathname = usePathname();

  const links =
    role === "admin"
      ? [
          { href: "/admin", label: "Overview" },
          { href: "/admin/availability", label: "Availability" },
          { href: "/admin/bookings", label: "Bookings" },
          { href: "/admin/users", label: "Users" },
          { href: "/dashboard", label: "Student view" },
        ]
      : [{ href: "/dashboard", label: "Book a session" }];

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold">EPT Scheduling</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{fullName}</span>
            <form action={logout}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                pathname === link.href && "bg-accent text-accent-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
