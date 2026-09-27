"use client";

import {
  BookOpen,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
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

/** The account menu is the same on every site: the four sites, Settings, Log out. */
export const ACCOUNT_MENU_LINKS = [
  { href: LANDING_URL, label: "Home", icon: Home },
  {
    href: "https://lessons.englishandportuguesewithtrevor.com",
    label: "Lessons",
    icon: BookOpen,
  },
  {
    href: "https://flashcards.englishandportuguesewithtrevor.com",
    label: "Flashcards",
    icon: Layers,
  },
  { href: "/dashboard", label: "Schedule a class", icon: CalendarPlus },
] as const;

function firstName(name: string | null, email: string | null) {
  return (name?.trim() || email || "").split(/\s+/)[0];
}

function AccountMenu({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string | null;
}) {
  const first = firstName(fullName, email);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold whitespace-nowrap text-white outline-none ring-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring dark:text-black">
        {first ? `Hi, ${first}` : "Account"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ACCOUNT_MENU_LINKS.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={label} asChild>
            {href.startsWith("/") ? (
              <Link href={href}>
                <Icon />
                {label}
              </Link>
            ) : (
              <a href={href}>
                <Icon />
                {label}
              </a>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  role,
  fullName,
  email,
  children,
}: {
  role: Role;
  fullName: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <a
            href={LANDING_URL}
            className="font-display text-lg leading-tight text-brand sm:text-xl"
            aria-label="English & Portuguese with Trevor, main website"
          >
            English <em className="text-brand-accent">&amp;</em> Portuguese with
            Trevor
          </a>
          <AccountMenu fullName={fullName} email={email} />
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
                  pathname === link.href && "bg-accent text-accent-foreground",
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
  );
}
