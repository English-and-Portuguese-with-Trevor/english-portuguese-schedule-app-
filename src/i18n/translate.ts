import type { SiteLanguage } from "@/lib/prefs";
import { STRINGS } from "@/i18n/strings";

export type Vars = Record<string, string | number>;
export type Translate = (text: string, vars?: Vars) => string;

// Site text is written in English and looked up in STRINGS for the site
// language (es, pt, fr). Text without a translation stays in English.
export function translate(
  language: SiteLanguage | null | undefined,
  text: string,
  vars?: Vars,
): string {
  const table =
    language && language !== "en"
      ? (STRINGS[language] as Record<string, string>)
      : undefined;
  const template = table?.[text] || text;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** A t(text, vars) function for `language`. */
export function translator(language: SiteLanguage): Translate {
  return (text, vars) => translate(language, text, vars);
}

export { tr } from "@/i18n/tr";
