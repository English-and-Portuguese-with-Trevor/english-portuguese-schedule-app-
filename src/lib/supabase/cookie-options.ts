const SITE_DOMAIN = "englishandportuguesewithtrevor.com";

/**
 * Every app stores the login in the same cookie on the shared parent domain, so
 * signing in on one site (landing, lessons, flashcards, schedule) signs you in on all.
 */
export function authCookieOptions(hostname: string, secure: boolean) {
  const host = hostname.split(":")[0];
  const onSite = host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`);
  return {
    name: "ept-auth",
    ...(onSite ? { domain: SITE_DOMAIN } : {}),
    secure,
  };
}
