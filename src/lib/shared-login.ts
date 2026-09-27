const SITE_DOMAIN = "englishandportuguesewithtrevor.com";
const SHARED_LOGIN = `https://${SITE_DOMAIN}/login/`;

/** On the live site, log in on the shared login page (Google or email); it sends people back to the dashboard. */
export function sharedLoginUrl(location: { hostname: string; origin: string }) {
  const onSite =
    location.hostname === SITE_DOMAIN ||
    location.hostname.endsWith(`.${SITE_DOMAIN}`);
  return onSite
    ? `${SHARED_LOGIN}?next=${encodeURIComponent(`${location.origin}/dashboard`)}`
    : null;
}
