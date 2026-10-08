"use client";

import {
  NotebookPen,
  Check,
  BookOpen,
  CalendarPlus,
  Dumbbell,
  MessagesSquare,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Smartphone,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LANDING_URL } from "@/components/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n/client";
import { tr } from "@/i18n/translate";
import { readPrefs, START_PAGES, type LearningLanguage, type StartPage } from "@/lib/prefs";
import { setStartPage, START_LABELS } from "@/lib/preferences";
import { logout } from "@/lib/actions/auth";

/**
 * The account menu is the same on every site, kept compact (Trevor, 2026-10-08):
 * Daily puzzles (gold) and Articles (underlined) as two tiles at the top, so they
 * stand out; Home, My progress and My notes (the notebook site, /notebook/, another
 * origin) on one row; a Learn sub-menu with the learning sites; Tools (the lessons
 * site's #/tools, Portuguese learners only); Schedule a class; App start; then
 * Settings and Log out side by side.
 */
const TOOLS_URL = "https://englishandportuguesewithtrevor.com/lessons/#/tools";

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
  learningLanguage = null,
}: {
  fullName: string | null;
  email: string | null;
  /** The profile's learning language; the ept-prefs cookie when unset, then Portuguese. */
  learningLanguage?: string | null;
  /** My notes is for Trevor's private students (a class package) and admins. */
  privateStudent: boolean;
}) {
  const first = firstName(fullName, email);
  const t = useT();
  // The cookie is only readable in the browser; read it after hydration.
  const [start, setStart] = useState<StartPage | null>(null);
  const [cookieLearning, setCookieLearning] = useState<LearningLanguage | null>(null);
  useEffect(() => {
    const prefs = readPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only cookie
    setStart(prefs.start ?? null);
    setCookieLearning(prefs.learning ?? null);
  }, []);
  const showTools = (learningLanguage ?? cookieLearning ?? "Portuguese") === "Portuguese";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex max-w-44 shrink-0 items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white outline-none ring-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring dark:text-black">
        <Menu className="size-4.5 shrink-0" aria-hidden />
        <span className="truncate">{first ? t("Hi, {name}", { name: first }) : t("Account")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 [&_[role=menuitem]]:py-1.5">
        {/* Daily puzzles and Articles side by side at the top, so they stand out (Trevor, 2026-10-08). */}
        <div className="mb-1 grid grid-cols-2 gap-2">
          <DropdownMenuItem
            asChild
            className="justify-center rounded-[10px] border-2 border-gold px-1.5 py-2.5! text-center font-semibold text-gold-text focus:text-gold-text"
          >
            <a href="https://englishandportuguesewithtrevor.com/dailies/">{t("Daily puzzles")}</a>
          </DropdownMenuItem>
          {/* Underlined so the articles stand out (Trevor, 2026-10-05). */}
          <DropdownMenuItem
            asChild
            className="justify-center rounded-[10px] border-2 border-brand px-1.5 py-2.5! text-center font-semibold underline decoration-2 underline-offset-4"
          >
            <a href="https://englishandportuguesewithtrevor.com/lessons/#/articles">{t("Articles")}</a>
          </DropdownMenuItem>
        </div>
        {/* Home, My progress and My notes on one row. */}
        <div className="mb-1 flex flex-wrap border-b border-line pb-1 [&_[role=menuitem]]:px-1.5">
          <DropdownMenuItem asChild>
            <a href={LANDING_URL}>{t("Home")}</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`${LANDING_URL}/notebook/#/progress`}>{t("My progress")}</a>
          </DropdownMenuItem>
          {privateStudent && (
            <DropdownMenuItem asChild>
              <a href={`${LANDING_URL}/notebook/`}>
                <NotebookPen />
                {t("My notes")}
              </a>
            </DropdownMenuItem>
          )}
        </div>
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
        {showTools && (
          <DropdownMenuItem asChild>
            <a href={TOOLS_URL}>
              <Wrench />
              {t("Tools")}
            </a>
          </DropdownMenuItem>
        )}
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
        {/* Settings and Log out side by side at the bottom. */}
        <div className="mt-1 flex items-center gap-2 border-t border-line pt-1.5">
          <DropdownMenuItem asChild className="flex-1">
            <Link href="/settings">
              <SettingsIcon />
              {t("Settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void logout()}
            className="border border-logout-border bg-logout text-logout-foreground focus:bg-logout-hover focus:text-logout-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut />
            {t("Log out")}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

