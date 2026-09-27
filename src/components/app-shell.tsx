"use client";

import {
  BookOpen,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  Dumbbell,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PrefsSync } from "@/components/prefs-sync";
import { SiteLanguageProvider, useT } from "@/i18n/client";
import { tr, translate } from "@/i18n/translate";
import type { SiteLanguage } from "@/lib/prefs";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export const LANDING_URL = "https://englishandportuguesewithtrevor.com";

const ADMIN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/dashboard", label: "Book", icon: CalendarPlus },
];

/**
 * The account menu is the same on every site: the five sites, Settings, Log
 * out. Activities isn't open to students yet (see its CLAUDE.md), so it's
 * admin-only for now — remove `adminOnly` here (and in every other repo's
 * account menu) once it is.
 */
export const ACCOUNT_MENU_LINKS = [
  { href: LANDING_URL, label: tr("Home"), icon: Home, adminOnly: false },
  {
    href: "https://lessons.englishandportuguesewithtrevor.com",
    label: tr("Lessons"),
    icon: BookOpen,
    adminOnly: false,
  },
  {
    href: "https://flashcards.englishandportuguesewithtrevor.com",
    label: tr("Flashcards"),
    icon: Layers,
    adminOnly: false,
  },
  {
    href: "https://activities.englishandportuguesewithtrevor.com",
    label: tr("Activities"),
    icon: Dumbbell,
    adminOnly: true,
  },
  {
    href: "/dashboard",
    label: tr("Schedule a class"),
    icon: CalendarPlus,
    adminOnly: false,
  },
] as const;

function firstName(name: string | null, email: string | null) {
  return (name?.trim() || email || "").split(/\s+/)[0];
}

function AccountMenu({
  fullName,
  email,
  isAdmin,
}: {
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
}) {
  const first = firstName(fullName, email);
  const t = useT();
  const links = ACCOUNT_MENU_LINKS.filter((link) => !link.adminOnly || isAdmin);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold whitespace-nowrap text-white outline-none ring-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring dark:text-black">
        {first ? t("Hi, {name}", { name: first }) : t("Account")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {links.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={label} asChild>
            {href.startsWith("/") ? (
              <Link href={href}>
                <Icon />
                {t(label)}
              </Link>
            ) : (
              <a href={href}>
                <Icon />
                {t(label)}
              </a>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            {t("Settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut />
          {t("Log out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  role,
  fullName,
  email,
  theme = null,
  learningLanguage = null,
  siteLanguage = "en",
  profileSiteLanguage = null,
  children,
}: {
  role: Role;
  fullName: string | null;
  email: string | null;
  /** The profile's saved preferences, shared with the other sites. */
  theme?: string | null;
  learningLanguage?: string | null;
  /** The language to show the site in (see i18n/server.ts). */
  siteLanguage?: SiteLanguage;
  profileSiteLanguage?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  return (
    <SiteLanguageProvider lang={siteLanguage}>
      <PrefsSync
        theme={theme}
        learningLanguage={learningLanguage}
        siteLanguage={profileSiteLanguage}
      />
      <div className="flex min-h-svh flex-col">
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <a
              href={LANDING_URL}
              className="font-display text-lg leading-tight text-brand sm:text-xl"
              aria-label={translate(
                siteLanguage,
                tr("English & Portuguese with Trevor, main website"),
              )}
            >
              English <em className="text-brand-accent">&amp;</em> Portuguese
              with Trevor
            </a>
            <AccountMenu fullName={fullName} email={email} isAdmin={isAdmin} />
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
            aria-label="Admin"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
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
