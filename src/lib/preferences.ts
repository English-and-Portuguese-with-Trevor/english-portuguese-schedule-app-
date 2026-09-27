import { createClient } from "@/lib/supabase/client";
import {
  applyThemeAttribute,
  readPrefs,
  writePrefs,
  type LearningLanguage,
  type Prefs,
  type Theme,
} from "@/lib/prefs";

// Theme and learning language: the shared ept-prefs cookie (every site reads it)
// plus, when logged in, the profile (it follows the person to other devices).
// The profile wins; a choice made before it had one is saved to it.

function save(
  fn: "set_theme" | "set_learning_language",
  args: Record<string, string>,
) {
  Promise.resolve()
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
  const next = writePrefs(patch);
  applyThemeAttribute(next.theme);
  return next;
}

export function setTheme(theme: Theme) {
  applyThemeAttribute(theme);
  writePrefs({ theme });
  save("set_theme", { theme });
}

export function setLearningLanguage(language: LearningLanguage) {
  writePrefs({ learning: language });
  save("set_learning_language", { lang: language });
}
