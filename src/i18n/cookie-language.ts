"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import type { Translate } from "@/i18n/translate";
import { readPrefs, siteLanguage, type SiteLanguage } from "@/lib/prefs";

const noopSubscribe = () => () => {};
const cookieLanguage = () => siteLanguage(readPrefs(), navigator.languages);
const serverLanguage = (): SiteLanguage => "en";
const english: Translate = (text, vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : text;

/**
 * The site language for the pages outside AppShell (/login and the status
 * pages). Nobody is logged in there, so it comes from the shared cookie (or
 * the browser); the server can't know it, so they show English until
 * hydrated, and the translations load only then, only for another language.
 */
export function useCookieLanguage(): { lang: SiteLanguage; t: Translate } {
  const wanted = useSyncExternalStore(noopSubscribe, cookieLanguage, serverLanguage);
  const [loaded, setLoaded] = useState<{ lang: SiteLanguage; t: Translate } | null>(null);
  useEffect(() => {
    if (wanted === "en") return;
    let live = true;
    void import("@/i18n/translate").then(({ translator }) => {
      if (live) setLoaded({ lang: wanted, t: translator(wanted) });
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  return loaded?.lang === wanted ? loaded : { lang: "en", t: english };
}
