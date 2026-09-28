@AGENTS.md

## Account menu, Settings, lifetime access
- The "Hi, name" account menu (`src/components/app-shell.tsx`) is the same on all four sites, in this order: Home, Lessons, Flashcards, Schedule a class, Settings, Log out.
- `/settings` (`src/components/account-settings.tsx`): lesson access, then Manage subscription (Stripe portal via the `billing` edge function) next to Delete account (the `delete-account` edge function). Both functions live in the flashcards-app repo.
- Lifetime lesson access: students qualify after three class sets (12 classes on the 4-class package, 24 on the 8-class package). Completed classes = past confirmed bookings + late cancellations + `profiles.earlier_classes`. The app only flags it (`my_class_progress` / `admin_class_progress` RPCs); Trevor gives `lifetime` by hand on the Users page. Never grant it automatically.

## Admin alerts (new sign-ups, new subscribers)
- Database triggers fill `admin_alerts` (a new `profiles` row; a `billing` subscription that starts). The admin header's bell shows the unread count, `/admin/alerts` lists them and has the push on/off switch (`src/components/admin/push-toggle.tsx`, service worker `public/sw.js`).
- Push goes DB (pg_net) -> `/api/alerts/push` (Bearer `CRON_SECRET`) -> `web-push` (`src/lib/admin-push.ts`). The VAPID keys live in `private.app_settings`, made once by the server; never replace them. See the README's "Alerts" section. Admin-only, so English only.

## Dark mode and shared preferences
- Dark mode and the language being learned are shared by all four sites through the `ept-prefs` cookie (`src/lib/prefs.ts`, same logic as `prefs.js` in the other repos; kept through log out). `THEME_SCRIPT` in the root layout's `<head>` sets `<html data-theme="dark">` before paint; don't read cookies in the root layout (that would stop static pages from prerendering).
- When logged in the profile (`theme`, `learning_language`) wins: `AppShell` renders `PrefsSync`, which copies it to the cookie (`src/lib/preferences.ts`). Settings has the Dark mode switch and "I'm learning"; the booking form's lesson language defaults to it when the student has no earlier booking.
- Dark colors live under `:root[data-theme="dark"]` in `globals.css` (Tailwind `dark:` follows the attribute, not the device setting). Don't add `prefers-color-scheme` rules.

## Site language (translations)
- Student-facing text (account menu, dashboard, booking, cancel dialog, class progress, Settings) is shown in the site language: English, Spanish, Portuguese or French (`SITE_LANGUAGES` in `src/lib/prefs.ts`). It's shared with the other sites through the `ept-prefs` cookie (`site`) and saved on the profile (`profiles.site_language`, `set_site_language` RPC); Settings has the Site language menu.
- The layouts pick it on the server (`getSiteLanguage()` in `src/i18n/server.ts`: profile, then cookie, then Accept-Language) and pass it to `AppShell`, which provides it to client components (`useT()` / `useSiteLanguage()` from `src/i18n/client.tsx`). Don't call `getSiteLanguage()` from the root layout or static pages (it reads cookies).
- Write text in English inside `t("…")` or `tr("…")` and add it to `src/i18n/strings.ts` under `es`, `pt` and `fr`; `src/i18n/i18n.test.ts` fails otherwise. Dates and times go through `formatDate()` in `src/i18n/format.ts` (English keeps the date-fns patterns). Server errors students can see are listed in `src/i18n/server-messages.ts`.
- Trevor's admin pages, the privacy page and the emails stay in English.

## DeepL translations
DeepL translates only the lessons site's lesson text, through the shared `translate` edge function (flashcards-app repo). Every translation is saved keyed on the text alone, so nothing is paid for twice, each deploy may send at most 25,000 new characters, and Claude reviews new rows (see the lessons repo's CLAUDE.md). This site's own text is hand-written in `src/i18n/strings.ts`; don't wire DeepL into it without asking Trevor.

## Workflow
Trevor approved pushing straight to `main` (no branches or pull requests) for all changes. Run the tests and build first. Still ask before anything that needs a dashboard setting changed first, would log people out, or could charge anyone.
