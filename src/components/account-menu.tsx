"use client";

import {
  ChartLine,
  NotebookPen,
  Check,
  BookOpen,
  CalendarPlus,
  Dumbbell,
  MessagesSquare,
  GraduationCap,
  Home,
  Puzzle,
  Layers,
  LogOut,
  Menu,
  Newspaper,
  Settings as SettingsIcon,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LANDING_URL } from "@/components/app-shell";
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
import { useT } from "@/i18n/client";
import { tr } from "@/i18n/translate";
import { readPrefs, START_PAGES, type StartPage } from "@/lib/prefs";
import { setStartPage, START_LABELS } from "@/lib/preferences";
import { logout } from "@/lib/actions/auth";

/**
 * The account menu is the same on every site: Home, My progress and My notes (the
 * notebook site, /notebook/, another origin), Daily puzzles (gold
 * lettering, so it stands out), Articles (underlined, so it stands out too), a Learn sub-menu with the learning sites, Schedule a class,
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

function firstName(name: string | null, email: string | null) {
  // No name on the profile: the part of the email before the @ will do.
  return (name?.trim() || email?.split("@")[0] || "").split(/\s+/)[0];
}

export default function AccountMenu({
  fullName,
  email,
  privateStudent,
}: {
  fullName: string | null;
  email: string | null;
  /** My notes is for Trevor's private students (a class package) and admins. */
  privateStudent: boolean;
}) {
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
        <Menu className="size-4.5 shrink-0" aria-hidden />
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
          <a href={`${LANDING_URL}/notebook/#/progress`}>
            <ChartLine />
            {t("My progress")}
          </a>
        </DropdownMenuItem>
        {privateStudent && (
          <DropdownMenuItem asChild>
            <a href={`${LANDING_URL}/notebook/`}>
              <NotebookPen />
              {t("My notes")}
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          asChild
          className="font-semibold text-gold-text focus:text-gold-text"
        >
          <a href="https://englishandportuguesewithtrevor.com/dailies/">
            <Puzzle />
            {t("Daily puzzles")}
          </a>
        </DropdownMenuItem>
        {/* Underlined so the articles stand out from the other rows (Trevor, 2026-10-05). */}
        <DropdownMenuItem asChild className="underline decoration-2 underline-offset-4">
          <a href="https://englishandportuguesewithtrevor.com/lessons/#/articles">
            <Newspaper />
            {t("Articles")}
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

