@AGENTS.md

## Account menu, Settings, lifetime access
- The "Hi, name" account menu (`src/components/app-shell.tsx`) is the same on every site, in this order: Home, Daily puzzles (gold lettering, kept out of Learn so it stands out), Learn (a sub-menu: Lessons, Flashcards, Activities, Conversations), Schedule a class, App start (a folded sub-menu: Lessons, Flashcards, Activities, Daily puzzles; the current choice on the row), Settings, Log out.
- `/settings` (`src/components/account-settings.tsx`): a short menu of full-width rows, the same shape on every site: Preferences › and Account › each open their own page with nothing else under it (‹ Settings returns; Account holds the name, email and lesson access), then Manage subscription (Stripe portal via the `billing` edge function; it opens for any account), Delete account (the `delete-account` edge function) and Log out. Both functions live in the flashcards-app repo.
- Lifetime lesson access: students qualify after three class sets (12 classes on the 4-class package, 24 on the 8-class package). Completed classes = past confirmed bookings + late cancellations + `profiles.earlier_classes`. The app only flags it (`my_class_progress` / `admin_class_progress` RPCs); Trevor gives `lifetime` by hand on the Users page. Never grant it automatically.

## Notices banner
`src/components/notices.tsx`, rendered under the header in `AppShell`, shows Trevor's notices from the `my_announcements` RPC (written on the admin dashboard, landing repo), exactly as written and never translated. Dismissals are per device in localStorage `ept-dismissed-notices`, separate from the other sites' because this app is its own origin.

## Admin alerts (new sign-ups, new subscribers)
- Database triggers fill `admin_alerts` (a new `profiles` row; a `billing` subscription that starts), and so does `flag_my_class`: students with lesson access (granted, subscriber, lifetime) can flag each of their classes once with a set reason, no notes, and take the flag back (`unflag_my_class`, which deletes its alert). Flags are pushed after a one-minute wait (pg_cron `push-waiting-flags`; a flag taken back sooner is never pushed) and emailed only in the 6:30 AM Mountain summary (`/api/cron/flags`). The lessons and activities sites' flags ("Report an issue") make `report` alerts the same way (`report_issue` / `unreport_issue`, `content_reports`). The admin header's bell shows the unread count, `/admin/alerts` lists them. Push is turned on only from the admin dashboard (landing repo, `/admin/#/alerts`, service worker `public/admin/sw.js` there), so each device has one subscription; this app has no push switch or service worker, and must not get one back (two switches meant two pushes per alert).
- Every alert is emailed to `ADMIN_NOTIFY_EMAIL` and pushed: DB (pg_net) -> `/api/alerts/push` (Bearer `CRON_SECRET`) -> `emails.adminAlerts` + `web-push` (`src/lib/admin-push.ts`); the daily job sends any the DB call missed. The VAPID keys live in `private.app_settings` (already made); never replace them. See the README's "Alerts" section. Admin-only, so English only.

## The admin dashboard calls this app
Trevor's admin dashboard lives on the landing site (`englishandportuguesewithtrevor.com/admin/`, landing repo) and approves, declines, cancels and books classes through `src/app/api/admin/route.ts` (POST `{action: confirm|cancel|book|test-push}`; `test-push` sends a typed test notification to the calling device only, found by its endpoint with `test_push_target`, CORS for that one origin, the shared login cookie, the same `confirmBooking`/`cancelBooking`/`adminBookStudent` actions), so every email and calendar invite still comes from here. Keep those actions' behavior and this route in step; the dashboard reads everything else straight from Supabase.

## Admin emails
Trevor gets an email for every scheduling change (`src/lib/notifications.ts`): the students' changes, and a copy of his own ("You approved", "You booked", "You moved", "You declined", "You canceled"). A new scheduling action needs both its student email and an admin email.

## Dark mode and shared preferences
- Dark mode and the language being learned are shared by all four sites through the `ept-prefs` cookie (`src/lib/prefs.ts`, same logic as `prefs.js` in the other repos; kept through log out). `THEME_SCRIPT` in the root layout's `<head>` sets `<html data-theme="dark">` before paint; don't read cookies in the root layout (that would stop static pages from prerendering).
- When logged in the profile (`theme`, `learning_language`) wins: `AppShell` renders `PrefsSync`, which copies it to the cookie (`src/lib/preferences.ts`). Settings has the Dark mode switch and "I'm learning"; the booking form's lesson language defaults to it when the student has no earlier booking.
- Dark colors live under `:root[data-theme="dark"]` in `globals.css` (Tailwind `dark:` follows the attribute, not the device setting). Don't add `prefers-color-scheme` rules.

## Site language (translations)
- Student-facing text (account menu, dashboard, booking, cancel dialog, class progress, Settings) is shown in the site language: English, Spanish, Portuguese or French (`SITE_LANGUAGES` in `src/lib/prefs.ts`). It's shared with the other sites through the `ept-prefs` cookie (`site`) and saved on the profile (`profiles.site_language`, `set_site_language` RPC); Settings has the Site language menu.
- The layouts pick it on the server (`getSiteLanguage()` in `src/i18n/server.ts`: profile, then cookie, then Accept-Language) and pass it to `AppShell`, which provides it to client components (`useT()` / `useSiteLanguage()` from `src/i18n/client.tsx`). Don't call `getSiteLanguage()` from the root layout or static pages (it reads cookies).
- Write text in English inside `t("…")` or `tr("…")` and add it to `src/i18n/strings.ts` under `es`, `pt` and `fr`; `src/i18n/i18n.test.ts` fails otherwise. Dates and times go through `formatDate()` in `src/i18n/format.ts` (English keeps the date-fns patterns). Server errors students can see are listed in `src/i18n/server-messages.ts`.
- Trevor's admin pages, the privacy page and the emails stay in English.
- Write English the American way (spelling and words: color, canceled, vacation, apartment), in the site's text and in English teaching content.

## DeepL translations
DeepL translates only the lessons site's lesson text, through the shared `translate` edge function (flashcards-app repo). Every translation is saved keyed on the text alone, so nothing is paid for twice, each deploy may send at most 25,000 new characters, and Claude reviews new rows (see the lessons repo's CLAUDE.md). This site's own text is hand-written in `src/i18n/strings.ts`; don't wire DeepL into it without asking Trevor.

## Portuguese and English stay separate
Trevor's rule for every site (2026-09-28): everything students practice is
split by the language they're learning, the "I'm learning" preference
(`learning` in the shared `ept-prefs` cookie; `profiles.learning_language`
when logged in, which wins). Portuguese material appears only for Portuguese
learners and English material only for English learners. Never put both in
one list, and never run from a Portuguese activity straight into an English
one. (The activities site does this with `catalogFor(learning)`; see its
CLAUDE.md.)

## One address, one app
The other sites share `englishandportuguesewithtrevor.com` (`/lessons/`, `/flashcards/`, `/activities/`, `/dailies/`, one installed app from the landing repo's manifest); this app stays at `schedule.englishandportuguesewithtrevor.com`, so links to it open outside the installed app. The account menu has "App start" (`start` in `ept-prefs`, `profiles.start_page` via `set_start_page`, `START_PAGES` in `prefs.ts`; Trevor wants it in the main menu, not under Settings): the section the installed app starts on.

## Brand in the header
Every site's header shows the brand on two lines, "English & Portuguese" over
"with Trevor" (a `<br />` before "with Trevor"; the ampersand in gold italic),
linking to the home page, with the "Hi, name" menu at the right. Trevor chose
this (2026-09-29); keep it on every page of every site.

## Keep it simple
- Make the smallest change that does the job. No new dependency, helper, abstraction, option or setting unless this task needs it now; use what the browser, Node and the existing code already provide first.
- Don't build for cases nobody asked for (fallbacks, flags, "future-proofing"). If the simple version leaves a real gap, say so in the reply instead of coding around it.
- Before finishing, re-read the diff and take out anything the task didn't need.
- Start every reply to Trevor with a fruit emoji (any fruit). It's a canary: if the fruit stops appearing, these instructions have dropped out of context, so read this file again.

## Workflow
Trevor approved pushing straight to `main` (no branches or pull requests) for all changes. Run the tests and build first. Still ask before anything that needs a dashboard setting changed first, would log people out, or could charge anyone.
A hook (`.claude/hooks/run-tests.sh`, wired in `.claude/settings.json`) runs the tests before every `git push` and at the end of any turn that leaves uncommitted changes; a red run blocks the push.
