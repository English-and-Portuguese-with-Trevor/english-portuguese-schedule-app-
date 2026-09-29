import { createClient } from "@/lib/supabase/client";
import {
  applyThemeAttribute,
  readPrefs,
  writePrefs,
  type LearningLanguage,
  type Prefs,
  type SiteLanguage,
  type StartPage,
  START_PAGES,
  type Theme,
} from "@/lib/prefs";

// Theme, site language and learning language: the shared ept-prefs cookie (every site reads it)
// plus, when logged in, the profile (it follows the person to other devices).
// The profile wins; a choice made before it had one is saved to it.

function save(
  fn: "set_theme" | "set_learning_language" | "set_site_language" | "set_start_page",
  args: Record<string, string>,
) {
  return Promise.resolve()
    .then(() => createClient().rpc(fn, args as never))
    .then(
      (res) =>
        res?.error &&
        console.error(`Failed to save preference (${fn})`, res.error),
    )
    .catch((e) => console.error(`Failed to save preference (${fn})`, e));
}

export function syncFromProfile(profile: {
  theme: string | null;
  learning_language: string | null;
  site_language?: string | null;
  start_page?: string | null;
}): Prefs {
  const saved = readPrefs();
  const patch: Prefs = {};
  if (profile.theme === "light" || profile.theme === "dark")
    patch.theme = profile.theme;
  else if (saved.theme) save("set_theme", { theme: saved.theme });
  if (
    profile.learning_language === "Portuguese" ||
    profile.learning_language === "English"
  ) {
    patch.learning = profile.learning_language;
  } else if (saved.learning)
    save("set_learning_language", { lang: saved.learning });
  if (
    profile.site_language === "en" ||
    profile.site_language === "es" ||
    profile.site_language === "pt" ||
    profile.site_language === "fr"
  )
    patch.site = profile.site_language;
  else if (saved.site) save("set_site_language", { lang: saved.site });
  if ((START_PAGES as readonly string[]).includes(profile.start_page ?? ""))
    patch.start = profile.start_page as StartPage;
  else if (saved.start) save("set_start_page", { page: saved.start });
  const next = writePrefs(patch);
  applyThemeAttribute(next.theme);
  return next;
}

export function setTheme(theme: Theme) {
  applyThemeAttribute(theme);
  writePrefs({ theme });
  save("set_theme", { theme });
}

/** Saves the site language to the cookie and the profile; resolves once saved. */
export function setSiteLanguage(language: SiteLanguage): Promise<unknown> {
  writePrefs({ site: language });
  return save("set_site_language", { lang: language });
}

/** Which section the installed app opens on (Settings > Preferences > "Open the app on"). */
export function setStartPage(page: StartPage) {
  writePrefs({ start: page });
  save("set_start_page", { page });
}

export function setLearningLanguage(language: LearningLanguage) {
  writePrefs({ learning: language });
  save("set_learning_language", { lang: language });
}
