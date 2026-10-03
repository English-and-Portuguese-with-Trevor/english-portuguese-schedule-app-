@AGENTS.md

## Account menu, Settings, lifetime access
- The "Hi, name" account menu (`src/components/app-shell.tsx`) is the same on every site, in this order: Home, My progress (`https://englishandportuguesewithtrevor.com/progress/`, the landing site's page), Daily puzzles (gold lettering, kept out of Learn so it stands out), Learn (a sub-menu: Lessons, Flashcards, Activities, Conversations), Schedule a class, App start (a folded sub-menu: Lessons, Flashcards, Activities, Daily puzzles; the current choice on the row), Settings, Log out.
- `/settings` (`src/components/account-settings.tsx`): a short menu of full-width rows, the same shape on every site: Preferences › (Dark mode, I'm learning, Site language), then Get the app (this app's own install: `InstallRow`, `src/lib/install-prompt.ts` catches `beforeinstallprompt` from `AppShell`; the two taps on an iPhone; "Installed as an app" once installed), and Account ›; Preferences and Account each open their own page with nothing else under it (‹ Settings returns; Account holds the name, email and lesson access), then Manage subscription (Stripe portal via the `billing` edge function; it opens for any account), Delete account (the `delete-account` edge function) and Log out. Both functions live in the flashcards-app repo.
- Lifetime lesson access: students qualify after three class sets (12 classes on the 4-class package, 24 on the 8-class package). Completed classes = past confirmed bookings + late cancellations + `profiles.earlier_classes`. The app only flags it (`my_class_progress` / `admin_class_progress` RPCs); Trevor gives `lifetime` by hand on the Users page. Never grant it automatically.

## 30-minute classes for new students
Trevor (2026-10-01): until he marks someone as his student (lesson access `granted` or `lifetime`, or a class package), they can only book 30-minute classes inside his availability windows; his students book the windows' length (1 hour). `isClassStudent` / `NEW_STUDENT_CLASS_MINUTES` in `src/lib/types.ts` pick the times on the dashboard, and `private.class_minutes` (used by `assert_lesson_time` for bookings and reschedules) enforces it in the database. Keep the two in step. Trevor's own bookings aren't limited.

## Days off
Trevor (2026-10-02): `public.availability_blocks` (`starts_on`, `ends_on`, inclusive; `supabase/migrations/20261002230000_days_off.sql`) holds dates when no class can be booked, on top of the weekly windows. `private.assert_lesson_time` refuses a booking or reschedule on one (the date in the window's time zone, Denver); the dashboard drops those dates from the times it offers (`daysOff` in `generateCandidateSlots`, `src/lib/slots.ts`). Keep the two in step. Trevor adds and removes them on this app's `/admin/availability` (Days off) and on the landing dashboard's Availability screen. Classes already booked on a day off stay booked.

## Notices banner
`src/components/notices.tsx`, rendered under the header in `AppShell`, shows Trevor's notices from the `my_announcements` RPC (written on the admin dashboard, landing repo), exactly as written and never translated. Dismissals are per device in localStorage `ept-dismissed-notices`, separate from the other sites' because this app is its own origin.

## Error reports
Uncaught errors and unhandled rejections in the browser, and errors the error pages (`error.tsx`, `global-error.tsx`) catch, go to Trevor's admin dashboard (Errors, landing repo) through the `report_client_error` RPC with site `schedule` (`src/lib/error-report.ts`, the same rules as the other sites' `errorReport.js`: at most 5 a page load, one per message, failures ignored, the student never sees anything). Started from `AppShell`.

## Admin alerts (new sign-ups, new subscribers)
- Database triggers fill `admin_alerts` (a new `profiles` row; a `billing` subscription that starts), and so does `flag_my_class`: students with lesson access (granted, subscriber, lifetime) can flag each of their classes once with a set reason, no notes, and take the flag back (`unflag_my_class`, which deletes its alert). Flags are pushed after a one-minute wait (pg_cron `push-waiting-flags`; a flag taken back sooner is never pushed) and emailed only in the 6:30 AM Mountain summary (`/api/cron/flags`). The lessons and activities sites' flags ("Report an issue") make `report` alerts the same way (`report_issue` / `unreport_issue`, `content_reports`). The admin header's bell shows the unread count, `/admin/alerts` lists them. Push is turned on only from the admin dashboard (landing repo, `/admin/#/alerts`, service worker `public/admin/sw.js` there), so each device has one subscription; this app has no push switch or service worker, and must not get one back (two switches meant two pushes per alert).
- Push and email are marked separately: `pushed_at` (pushes, 2-day window) and `emailed_at` (sign-up and subscriber emails, 14-day window; flags and reports use it for the morning email), both claimed in `claim_alert_pushes`, so a retried email never pushes again.
- Every alert is emailed to `ADMIN_NOTIFY_EMAIL` and pushed: DB (pg_net) -> `/api/alerts/push` (Bearer `CRON_SECRET`) -> `emails.adminAlerts` + `web-push` (`src/lib/admin-push.ts`); the daily job sends any the DB call missed. The VAPID keys live in `private.app_settings` (already made); never replace them. See the README's "Alerts" section. Admin-only, so English only.

## The admin dashboard calls this app
Trevor's admin dashboard lives on the landing site (`englishandportuguesewithtrevor.com/admin/`, landing repo) and approves, declines, cancels and books classes through `src/app/api/admin/route.ts` (POST `{action: confirm|cancel|book|book-series|test-push}`; `book-series` books up to 26 classes for one student at once (`adminBookSeries`: a calendar invite per class, one `adminBookedSeries` summary email to Trevor, taken times skipped and listed); `test-push` sends a typed test notification to the calling device only, found by its endpoint with `test_push_target`, CORS for that one origin, the shared login cookie, the same `confirmBooking`/`cancelBooking`/`adminBookStudent` actions), so every email and calendar invite still comes from here. Once Trevor has Google Authenticator set up, this route and the `/admin` pages need a session that entered the code (`aal2`; entered on the dashboard, landing repo's `TwoFactor.jsx`), like the database's `is_admin()`. Keep those actions' behavior and this route in step; the dashboard reads everything else straight from Supabase.

## Admin checks
Every admin server action and admin route, now and in the future, checks the caller itself with `requireAdmin()` (server actions; throws) or `checkAdmin(supabase)` (returns why it refused) from `src/lib/auth/require-admin.ts`: an admin profile and, once Trevor has a verified Google Authenticator factor, an `aal2` session, the same rule as the `/admin` layout and the database's `is_admin()`. Never rely on the page layout alone, and never write another copy of the check.

## Admin emails
Trevor gets an email for every scheduling change (`src/lib/notifications.ts`): the students' changes, and a copy of his own ("You approved", "You booked", "You moved", "You declined", "You canceled"). A new scheduling action needs both its student email and an admin email, in the branded template (`renderEmail`): Google's calendar invitation doesn't count as the student's email. A class Trevor books sends the student `confirmed`; a series sends one `seriesBooked` listing every lesson.
- Welcome email (student email, Trevor 2026-10-02): every new account gets `emails.welcome` once (what's free, Get the app via `/?install=1`, Book a class), sent by `sendWelcomes` (`src/lib/welcome.ts`) from `/api/alerts/push` and the daily job. `claim_welcome_emails` marks `profiles.welcomed_at` first (a failed email is handed back with `unclaim_welcome_emails`), so it goes exactly once; accounts made before it existed were marked welcomed and never get it.

## Email volume
Trevor (2026-10-02): "I don't want email overload." Before adding any email, fold it into one that already goes out if you can: Trevor's daily agenda (`emails.adminAgenda`), the 6:30 AM flags summary (`emails.flagDigest`) or the Monday weekly summary. Students get only the emails their own actions (or Trevor's on their classes) trigger, plus the one welcome email. No marketing, newsletters or nudges unless Trevor asks. The README's "Every email the system sends" lists them all; keep it current.

## Dark mode and shared preferences
- Dark mode and the language being learned are shared by every site through the `ept-prefs` cookie (`src/lib/prefs.ts`, same logic as `prefs.js` in the other repos; kept through log out). `THEME_SCRIPT` in the root layout's `<head>` sets `<html data-theme="dark">` before paint; don't read cookies in the root layout (that would stop static pages from prerendering).
- When logged in the profile (`theme`, `learning_language`) wins: `AppShell` renders `PrefsSync`, which copies it to the cookie (`src/lib/preferences.ts`). Settings has the Dark mode switch and "I'm learning"; the booking form's lesson language defaults to it when the student has no earlier booking.
- Dark colors live under `:root[data-theme="dark"]` in `globals.css` (Tailwind `dark:` follows the attribute, not the device setting). Don't add `prefers-color-scheme` rules.

## Site language (translations)
- Student-facing text (account menu, dashboard, booking, cancel dialog, class progress, Settings) is shown in the site language: English, Spanish, Portuguese or French (`SITE_LANGUAGES` in `src/lib/prefs.ts`). It's shared with the other sites through the `ept-prefs` cookie (`site`) and saved on the profile (`profiles.site_language`, `set_site_language` RPC); Settings has the Site language menu.
- The layouts pick it on the server (`getSiteLanguage()` in `src/i18n/server.ts`: profile, then cookie, then Accept-Language) and pass it to `AppShell`, which provides it to client components (`useT()` / `useSiteLanguage()` from `src/i18n/client.tsx`). Don't call `getSiteLanguage()` from the root layout or static pages (it reads cookies).
- Write text in English inside `t("…")` or `tr("…")` and add it to `src/i18n/strings.ts` under `es`, `pt` and `fr`; `src/i18n/i18n.test.ts` fails otherwise. Dates and times go through `formatDate()` in `src/i18n/format.ts` (English keeps the date-fns patterns). Server errors students can see are listed in `src/i18n/server-messages.ts`.
- Trevor's admin pages, the privacy page and the emails stay in English.
- Write English the American way (spelling and words: color, canceled, vacation, apartment), in the site's text and in English teaching content.

## DeepL translations
DeepL translates only the lessons site's lesson text, through the shared `translate` edge function (flashcards-app repo). Every translation is saved keyed on the text alone, so nothing is paid for twice, each deploy may send at most 25,000 new characters, and Claude reviews new rows (see the lessons repo's CLAUDE.md). This site's own text is hand-written in `src/i18n/strings.ts`; don't wire DeepL into it without asking Trevor. DeepL is on hold (Trevor, 2026-09-30), so the daily job's monthly "DeepL credits reset" email is off (`DEEPL_ON_HOLD` in `src/lib/daily-job.ts`) until he says so.

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
The other sites share `englishandportuguesewithtrevor.com` (`/lessons/`, `/flashcards/`, `/activities/`, `/dailies/`, `/conversations/`, one installed app from the landing repo's manifest); this app stays at `schedule.englishandportuguesewithtrevor.com`, so links to it open outside the installed app. Instead it's its own installable app, "EPT Schedule" (Trevor, 2026-10-02): `src/app/manifest.ts` (start `/dashboard`, icons in `public/icons/`, copied from the landing repo) and the Get the app row in Settings. No service worker (see Admin alerts). The account menu has "App start" (`start` in `ept-prefs`, `profiles.start_page` via `set_start_page`, `START_PAGES` in `prefs.ts`; Trevor wants it in the main menu, not under Settings): the section the installed app starts on.

## Ideas for later
- Monthly summary email to every student (Trevor, 2026-10-02: "eventually"): how many classes they have left on their package and what they went over that month (classes taken, lessons finished, activities, puzzles, flashcards). Not built yet; when it is, it replaces other student emails where it can (see Email volume) and needs Trevor's go-ahead on the wording first.

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
After each push to `main`, `.github/workflows/smoke.yml` waits for Vercel's production deploy of that commit and runs `e2e/smoke.spec.ts` (Playwright) against the live site; a red run makes GitHub email Trevor. Run it locally against `next start` with `SMOKE_URL=http://localhost:3000 npx playwright test`.
