"use client";

import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { lazy, Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";

import { Notices } from "@/components/notices";
import { PrefsSync } from "@/components/prefs-sync";
import { SiteLanguageProvider } from "@/i18n/client";
import { tr, translate } from "@/i18n/translate";
import type { SiteLanguage } from "@/lib/prefs";
import { startErrorReports } from "@/lib/error-report";
// Catches the browser's install offer at startup, for Settings' Get the app row.
import "@/lib/install-prompt";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export const LANDING_URL = "https://englishandportuguesewithtrevor.com";

// The account menu (Radix's dropdown and its positioning) is its own file:
// the page renders it on the server and hydrates the rest without waiting for it.
const AccountMenu = lazy(() => import("@/components/account-menu"));

const ADMIN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  // The booking board (the app's start page): each day's classes at a glance (Trevor, 2026-10-03).
  { href: "/dashboard", label: "Today", icon: CalendarCheck },
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AppShell({
  role,
  fullName,
  email,
  theme = null,
  learningLanguage = null,
  siteLanguage = "en",
  profileSiteLanguage = null,
  startPage = null,
  classPackage = null,
  notesAccess = false,
  unreadAlerts = 0,
  children,
}: {
  role: Role;
  fullName: string | null;
  email: string | null;
  /** The profile's saved preferences, shared with the other sites. */
  theme?: string | null;
  learningLanguage?: string | null;
  startPage?: string | null;
  /** The class package (4 or 8) of Trevor's private students; My notes is for them (and admins). */
  classPackage?: number | null;
  /** Accounts Trevor gave My notes without a package (testers, future students). */
  notesAccess?: boolean;
  /** The language to show the site in (see i18n/server.ts). */
  siteLanguage?: SiteLanguage;
  profileSiteLanguage?: string | null;
  /** Admins only: new sign-ups and subscribers not seen yet (the bell's number). */
  unreadAlerts?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  // Uncaught errors go to Trevor's admin dashboard (Errors).
  useEffect(() => {
    startErrorReports();
  }, []);

  return (
    <SiteLanguageProvider lang={siteLanguage}>
      <PrefsSync
        theme={theme}
        learningLanguage={learningLanguage}
        siteLanguage={profileSiteLanguage}
        startPage={startPage}
      />
      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <a
              href={LANDING_URL}
              className="title text-lg leading-tight sm:text-xl"
              aria-label={translate(
                siteLanguage,
                tr("English & Portuguese With Trevor, main website"),
              )}
            >
              English <em className="text-brand-accent">&amp;</em> Portuguese
              <br />
              With Trevor
            </a>
            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin/alerts"
                  aria-label={unreadAlerts ? `Alerts, ${unreadAlerts} new` : "Alerts"}
                  aria-current={pathname === "/admin/alerts" ? "page" : undefined}
                  className="relative rounded-full p-2 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Bell className="size-5" aria-hidden />
                  {unreadAlerts > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] leading-5 font-semibold text-destructive-foreground"
                    >
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </span>
                  )}
                </Link>
              )}
              <Suspense>
                <AccountMenu fullName={fullName} email={email} privateStudent={role === "admin" || classPackage != null || notesAccess} />
              </Suspense>
            </div>
          </div>
          {isAdmin && (
            // Wide screens: a tab row under the header. Phones use the bottom bar below.
            <nav
              aria-label="Admin"
              className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 sm:flex"
            >
              {ADMIN_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    pathname === link.href &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </header>
        <Notices />

        <main
          className={cn(
            "mx-auto w-full max-w-5xl flex-1 px-4 py-8",
            isAdmin && "pb-24 sm:pb-8",
          )}
        >
          {children}
        </main>

        {isAdmin && (
          <nav
            aria-label="Admin (phone)"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
          >
            {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
                  pathname === href && "text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </SiteLanguageProvider>
  );
}
