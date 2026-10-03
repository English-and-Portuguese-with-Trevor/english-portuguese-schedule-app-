"use client";

import {
  Bell,
  ChartLine,
  Check,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Dumbbell,
  MessagesSquare,
  GraduationCap,
  Home,
  Puzzle,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Notices } from "@/components/notices";
import { PrefsSync } from "@/components/prefs-sync";
import { SiteLanguageProvider, useT } from "@/i18n/client";
import { tr, translate } from "@/i18n/translate";
import { readPrefs, START_PAGES, type SiteLanguage, type StartPage } from "@/lib/prefs";
import { startErrorReports } from "@/lib/error-report";
import { setStartPage } from "@/lib/preferences";
import { logout } from "@/lib/actions/auth";
// Catches the browser's install offer at startup, for Settings' Get the app row.
import "@/lib/install-prompt";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export const LANDING_URL = "https://englishandportuguesewithtrevor.com";

const ADMIN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  // The booking board (the app's start page): each day's classes at a glance (Trevor, 2026-10-03).
  { href: "/dashboard", label: "Today", icon: CalendarCheck },
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/users", label: "Users", icon: Users },
];

/**
 * The account menu is the same on every site: Home, My progress (the landing
 * site's /progress/, another origin), Daily puzzles (gold
 * lettering, so it stands out), a Learn sub-menu with the learning sites, Schedule a class,
 * App start, Settings, Log out.
 */
export const LEARN_LINKS = [
  {
    href: "https://englishandportuguesewithtrevor.com/lessons/",
    label: tr("Lessons"),
    icon: BookOpen,
  },
  {
    href: "https://englishandportuguesewithtrevor.com/flashcards/",
    label: tr("Flashcards"),
    icon: Layers,
  },
  {
    href: "https://englishandportuguesewithtrevor.com/activities/",
    label: tr("Activities"),
    icon: Dumbbell,
  },
  {
    href: "https://englishandportuguesewithtrevor.com/conversations/",
    label: tr("Conversations"),
    icon: MessagesSquare,
  },
] as const;

// "App start": where the installed app starts (the shared `start` preference).
const START_LABELS: Record<StartPage, string> = {
  lessons: tr("Lessons"),
  flashcards: tr("Flashcards"),
  activities: tr("Activities"),
  dailies: tr("Daily puzzles"),
};

function firstName(name: string | null, email: string | null) {
  // No name on the profile: the part of the email before the @ will do.
  return (name?.trim() || email?.split("@")[0] || "").split(/\s+/)[0];
}

function AccountMenu({ fullName, email }: { fullName: string | null; email: string | null }) {
  const first = firstName(fullName, email);
  const t = useT();
  // The cookie is only readable in the browser; read it after hydration.
  const [start, setStart] = useState<StartPage | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only cookie
    setStart(readPrefs().start ?? null);
  }, []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex max-w-44 shrink-0 items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white outline-none ring-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring dark:text-black">
        <Menu className="size-[18px] shrink-0" aria-hidden />
        <span className="truncate">{first ? t("Hi, {name}", { name: first }) : t("Account")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={LANDING_URL}>
            <Home />
            {t("Home")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${LANDING_URL}/progress/`}>
            <ChartLine />
            {t("My progress")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="font-semibold text-gold-text focus:text-gold-text"
        >
          <a href="https://englishandportuguesewithtrevor.com/dailies/">
            <Puzzle />
            {t("Daily puzzles")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GraduationCap />
            {t("Learn")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LEARN_LINKS.map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem key={label} asChild>
                <a href={href}>
                  <Icon />
                  {t(label)}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <CalendarPlus />
            {t("Schedule a class")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Smartphone />
            <span className="whitespace-nowrap">{t("App start")}</span>
            {start && <span className="ml-auto truncate text-muted-foreground">{t(START_LABELS[start])}</span>}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {START_PAGES.map((page) => (
              <DropdownMenuItem
                key={page}
                onSelect={() => {
                  setStartPage(page);
                  setStart(page);
                }}
              >
                {page === start ? <Check /> : <span className="size-4" />}
                {t(START_LABELS[page])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            {t("Settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void logout()}
          className="mt-1 border border-logout-border bg-logout text-logout-foreground focus:bg-logout-hover focus:text-logout-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
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
  startPage = null,
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
              <br />
              with Trevor
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
              <AccountMenu fullName={fullName} email={email} />
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
