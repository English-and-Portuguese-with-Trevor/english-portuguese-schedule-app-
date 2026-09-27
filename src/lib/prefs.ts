// Preferences shared by all four sites (home, lessons, flashcards, schedule):
// light/dark theme, the language being learned, and the translation language.
// They live in one cookie on the parent domain, so they survive logging out
// and follow the person from site to site. When someone is logged in, their
// profile (theme, learning_language, translation_language) is the source of
// truth and each site copies it into this cookie. Same logic as prefs.js in
// the other repos; keep them in step.
export const PREFS_COOKIE = "ept-prefs";
const SITE_DOMAIN = "englishandportuguesewithtrevor.com";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";
export type LearningLanguage = "Portuguese" | "English";
export interface Prefs {
  theme?: Theme;
  learning?: LearningLanguage;
  translation?: string;
}
type Patch = { [K in keyof Prefs]?: Prefs[K] | null };

const valid: Record<keyof Prefs, (v: unknown) => boolean> = {
  theme: (v) => v === "light" || v === "dark",
  learning: (v) => v === "Portuguese" || v === "English",
  translation: (v) => typeof v === "string" && /^[A-Z][A-Za-z]{1,29}$/.test(v),
};

function clean(prefs: Record<string, unknown> | null | undefined): Prefs {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(valid) as (keyof Prefs)[]) {
    if (prefs && valid[key](prefs[key])) out[key] = prefs[key];
  }
  return out as Prefs;
}

/** Preferences from a cookie string; anything unexpected is ignored. */
export function parsePrefs(cookieString = ""): Prefs {
  const match = cookieString.match(
    new RegExp(`(?:^|;\\s*)${PREFS_COOKIE}=([^;]*)`),
  );
  if (!match) return {};
  try {
    return clean(JSON.parse(decodeURIComponent(match[1])));
  } catch {
    return {};
  }
}

export function readPrefs(doc: Document = document): Prefs {
  try {
    return parsePrefs(doc.cookie);
  } catch {
    return {};
  }
}

/** Merges `patch` into the saved preferences (null removes a key) and returns the result. */
export function writePrefs(
  patch: Patch,
  doc: Pick<Document, "cookie"> = document,
  location: Pick<Location, "hostname" | "protocol"> = window.location,
): Prefs {
  const merged: Record<string, unknown> = {
    ...parsePrefs(doc.cookie),
    ...patch,
  };
  for (const [key, value] of Object.entries(patch))
    if (value === null) delete merged[key];
  const next = clean(merged);
  const host = location.hostname;
  const onSite = host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`);
  try {
    doc.cookie = [
      `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(next))}`,
      "Path=/",
      `Max-Age=${ONE_YEAR}`,
      "SameSite=Lax",
      onSite ? `Domain=${SITE_DOMAIN}` : null,
      location.protocol === "https:" ? "Secure" : null,
    ]
      .filter(Boolean)
      .join("; ");
  } catch {
    // Cookies blocked: the preference still applies for this visit.
  }
  return next;
}

/** Sets <html data-theme> so the CSS variables switch palettes. */
export function applyThemeAttribute(
  theme: Theme | undefined,
  doc: Document = document,
) {
  if (theme === "dark") doc.documentElement.dataset.theme = "dark";
  else delete doc.documentElement.dataset.theme;
}

/** Runs in <head> before paint (see app/layout.tsx): dark theme from the shared cookie. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${PREFS_COOKIE}=([^;]*)/);if(m&&JSON.parse(decodeURIComponent(m[1])).theme==="dark")document.documentElement.dataset.theme="dark"}catch(e){}})()`;

/** The booking form's lesson language for someone learning `learning`. */
export function learningToLessonLanguage(
  learning: string | null | undefined,
): "ENGLISH" | "PORTUGUESE" | undefined {
  if (learning === "English") return "ENGLISH";
  if (learning === "Portuguese") return "PORTUGUESE";
  return undefined;
}
