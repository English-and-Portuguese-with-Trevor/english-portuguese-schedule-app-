import { cookies, headers } from "next/headers";

import {
  acceptLanguages,
  parsePrefs,
  PREFS_COOKIE,
  siteLanguage,
  SITE_LANGUAGES,
  type SiteLanguage,
} from "@/lib/prefs";

function isSiteLanguage(value: unknown): value is SiteLanguage {
  return SITE_LANGUAGES.some((l) => l.code === value);
}

/**
 * The site language for this request: the profile's choice when logged in,
 * else the shared ept-prefs cookie, else the browser's Accept-Language.
 * Reading cookies makes the page dynamic, so only call it from pages that
 * already are (anything behind login).
 */
export async function getSiteLanguage(
  profileLanguage?: string | null,
): Promise<SiteLanguage> {
  if (isSiteLanguage(profileLanguage)) return profileLanguage;
  const cookieStore = await cookies();
  const raw = cookieStore.get(PREFS_COOKIE)?.value;
  const prefs = raw ? parsePrefs(`${PREFS_COOKIE}=${raw}`) : {};
  const headerStore = await headers();
  return siteLanguage(
    prefs,
    acceptLanguages(headerStore.get("accept-language")),
  );
}
