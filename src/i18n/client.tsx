"use client";

import { createContext, useCallback, useContext, useEffect } from "react";

import type { SiteLanguage } from "@/lib/prefs";
import { translate, type Translate } from "@/i18n/translate";

const SiteLanguageContext = createContext<SiteLanguage>("en");

/** Gives client components the site language the server picked (see i18n/server.ts). */
export function SiteLanguageProvider({
  lang,
  children,
}: {
  lang: SiteLanguage;
  children: React.ReactNode;
}) {
  // The root layout stays static, so <html lang> is set here.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <SiteLanguageContext.Provider value={lang}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage(): SiteLanguage {
  return useContext(SiteLanguageContext);
}

/** A t(text, vars) function for the current site language. */
export function useT(): Translate {
  const lang = useContext(SiteLanguageContext);
  return useCallback<Translate>(
    (text, vars) => translate(lang, text, vars),
    [lang],
  );
}
