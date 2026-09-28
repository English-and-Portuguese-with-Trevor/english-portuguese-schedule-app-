const SITE_DOMAIN = "englishandportuguesewithtrevor.com";
const SHARED_LOGIN = `https://${SITE_DOMAIN}/login/`;

/**
 * On the live site, log in on the shared login page (Google or email); it
 * sends people back to `nextPath` here (the dashboard, or the page they were
 * opening, e.g. the Bookings page from an "Approve or decline" email).
 */
export function sharedLoginUrl(
  location: { hostname: string; origin: string },
  nextPath = "/dashboard",
) {
  const onSite =
    location.hostname === SITE_DOMAIN ||
    location.hostname.endsWith(`.${SITE_DOMAIN}`);
  return onSite
    ? `${SHARED_LOGIN}?next=${encodeURIComponent(`${location.origin}${nextPath}`)}`
    : null;
}
