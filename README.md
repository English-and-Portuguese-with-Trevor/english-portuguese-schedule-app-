# EPT Scheduling

Booking app for English & Portuguese with Trevor, live at
[schedule.englishandportuguesewithtrevor.com](https://schedule.englishandportuguesewithtrevor.com).
Next.js on Vercel, with Supabase for auth (Google, shared with the flashcards
app) and the database.

## Running locally

```bash
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev                  # http://localhost:3000
```

## Database

`supabase/migrations/` holds every change made to the scheduling tables, in
order, named to match the migration history in Supabase. To change the
database, add a new file there (never edit an old one) and apply it to the
project, then run the database tests below.

The Supabase project is shared with the flashcards app. The `profiles` table
comes from that app's migrations; these files only add to it.

## Backups

The nightly database backup runs from the private **flashcards-app** repo
(`.github/workflows/database-backup.yml`, setup and restore steps in its
README). It must not live here: this repo is public, and anyone can download
Actions artifacts from a public repo.

## Google Meet links and emails

Confirmed lessons become events on the englishportuguesewithtrevor@gmail.com
calendar with a Google Meet link, and the student is invited, so Google sends
them the invitation, changes, cancellations, and reminders. Other
notifications go out through that account's Gmail (see
`src/lib/notifications.ts` for the full list).

The admin gets an email for every scheduling change: the ones students make
(new lesson, approval needed, reschedule requested or withdrawn,
cancellations) and a copy of the ones the admin makes ("You approved", "You
booked", "You moved", "You declined", "You canceled"), plus new sign-ups and
subscribers (see "Alerts" below). New students get a welcome email (see "Alerts" below).

This needs four environment variables in Vercel (see `.env.example`). Without
the three `GOOGLE_*` ones, bookings still work; nothing is sent.

To get a new refresh token (for example if Google revokes the old one):

1. In the Google Cloud project that owns the OAuth client, the app must be
   published ("Em produção"), not in testing; test-mode tokens expire after
   7 days.
2. Open developers.google.com/oauthplayground, click the gear, check "Use your
   own OAuth credentials", and enter the client ID and secret.
3. Authorize these scopes, signed in as englishportuguesewithtrevor@gmail.com:
   `https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send`
4. Exchange the code for tokens, copy the refresh token into
   `GOOGLE_REFRESH_TOKEN` in Vercel, and redeploy.

A Google error never blocks a booking; it's logged in Vercel's function logs
with a `[notifications]` prefix.

## Daily job: reminders and your agenda

`vercel.json` runs `/api/cron/daily` once a day at 13:00 UTC (7 AM Mountain
in summer, 6 AM in winter). It:

- checks the Google connection and records the result (shown on the admin
  Overview);
- emails each student one reminder for lessons in the next 36 hours;
- emails the admin the next 24 hours of lessons plus requests waiting for
  approval;
- on Mondays (in the admin's time zone), emails the admin the weekly summary
  (`weekly_summary`, `supabase/migrations/20261003010000_weekly_summary.sql`):
  the last 7 days' new sign-ups and subscribers, active students (anything
  done on any site, or a booking), lessons finished, puzzles played,
  activities finished, flashcards studied, classes held and canceled, the
  next 7 days' classes, and students quiet for 14 days or more. Trevor's own
  practice isn't counted.

It is guarded by a shared secret stored in two places that must match:
`CRON_SECRET` in Vercel, and `private.app_settings` (key `cron_secret`) in
Supabase. To rotate it, generate a new value and update both:

```sql
update private.app_settings set value = '<new secret>' where key = 'cron_secret';
```

## Every email the system sends

Kept short on purpose (Trevor: no email overload). Before adding one, see
"Email volume" in CLAUDE.md. All of these come from this app
(`src/lib/notifications.ts`, through the englishportuguesewithtrevor@gmail.com
Gmail) unless noted.

**Students** get only what their own actions (or Trevor's on their classes)
cause, plus one welcome and a monthly summary:

| Email | When |
| --- | --- |
| Welcome | Once, when the account is made |
| Your month | The 1st, with the daily job, to every student who did anything the month before: their classes and practice in the language they're learning (`claim_monthly_summaries`) |
| Lesson confirmed | They book 72+ hours ahead, Trevor approves their request, or Trevor books them |
| Lessons booked (one email for a series) | Trevor books a series for them |
| Lesson request received | They book less than 72 hours ahead (waits for approval) |
| Lesson request not available | Trevor declines a request |
| Lesson canceled | Trevor cancels a confirmed class |
| Reschedule request received / Lesson moved / Reschedule not available | They ask to move a class; Trevor approves or declines |
| Lesson reminder | Daily job (7 AM Mountain), once per class in the next 36 hours |
| Google Calendar invitation, changes, reminders | Google sends these for every confirmed class (not branded) |
| Confirm sign-up, reset password | Supabase Auth (through Resend), when they ask for one |

**Trevor** (`ADMIN_NOTIFY_EMAIL`):

| Email | When |
| --- | --- |
| A copy of every scheduling change | New booking, approval needed, student canceled, reschedule asked or withdrawn, and "You approved / booked / booked a series / moved / declined / canceled" |
| Your day | Daily job, 13:00 UTC (7 AM Mountain in summer, 6 AM in winter): the next 24 hours of classes and waiting requests; none on a day with nothing |
| Your week | Mondays with the daily job: the weekly summary (see "Daily job") |
| New sign-up / new subscriber | As it happens (several at once come as one email) |
| Flags and reported issues | One summary at 6:30 AM Mountain; none when there are no flags |
| DeepL credits reset | On hold (`DEEPL_ON_HOLD` in `src/lib/daily-job.ts`) |
| Smoke check failed | GitHub emails him when the smoke check workflow fails after a deploy (see "Smoke check") |

## Admin calendar

`/admin/calendar` shows every class (waiting, confirmed, canceled, late
cancellations, past ones too) and the weekly open hours, by month or by week
(`?view=week&date=2026-09-29`), in the device's time zone. Clicking a day opens
it: approve, decline or cancel its classes, book a student, or turn a weekly
window off. It uses the same server actions as the Bookings and Availability
pages (`src/components/admin/booking-parts.tsx` holds what the two booking
pages share), so every change sends the usual emails. Hours can't be changed
for a single date yet; windows are weekly.

## Alerts: new sign-ups, new subscribers, flagged classes

The bell in the admin header counts alerts not seen yet; `/admin/alerts` lists
them (newest first) and marks them read. The database makes them
(`supabase/migrations/20260928093244_admin_alerts.sql`): a trigger on
`profiles` for every new account, and one on `billing` when a Stripe
subscription starts (or starts again after ending; a payment retry going
from past_due back to active is not new).

Flagged classes: students whose lesson access is `granted`, `subscriber` or `lifetime` see a
flag on each confirmed class on their dashboard (upcoming ones, and a "Recent
classes" list for the past week). Tapping it asks for one of three set
reasons (connection or Meet, time or booking, something else; no notes), and
`flag_my_class` saves it on the booking and makes a `flag` alert. One flag per
class (`supabase/migrations/20260930113255_class_flags.sql`); tapping
"Flagged" takes it back (`unflag_my_class`), which deletes its alert too, so it
never reaches the morning email if that hasn't gone out yet. A flag waits a
minute before it's pushed (`20260930115740_flag_push_wait.sql`): the flag is
skipped by `claim_alert_pushes` until then, and a pg_cron job
(`push-waiting-flags`, every minute) asks for the push once it has waited, so
a flag taken back within the minute never makes a notification.

Reported issues: the lessons and activities sites have the same kind of flag
on each lesson section, each activity question and at the bottom of their
pages ("Report an issue"), with four set reasons. `report_issue` saves it in
`content_reports` (one per student per item; `unreport_issue` takes it back)
and makes a `report` alert, handled exactly like a class flag
(`20260930122136_content_reports.sql`). A flag is pushed
and listed at once, but emailed only in the morning: `/api/cron/flags` runs at
12:30 and 13:30 UTC (`vercel.json`), and the run that falls at 6 AM in Denver
emails every flag not emailed yet (`claim_flag_digest`), so the email arrives
at 6:30 AM Mountain, summer or winter. No flags, no email.

Each alert is also emailed to `ADMIN_NOTIFY_EMAIL` (several at once come as
one email), through the same Gmail connection as the booking emails. The push and the email are
marked separately (`pushed_at`, `emailed_at`), so an email that failed is sent
again (for up to 14 days) without pushing again
(`20261003000000_alerts_welcome.sql`).

Welcome email: every new account gets one branded welcome email (what's free, the placement test,
how to get the app, how to book a class), sent with the sign-up alert by
`/api/alerts/push` or, if that call was missed, by the daily job.
`claim_welcome_emails` marks `profiles.welcomed_at` first, so it goes out once;
accounts made before it existed never get it.

Push notifications: on the admin dashboard's Alerts tab
(`englishandportuguesewithtrevor.com/admin/#/alerts`, landing repo), **Turn on
push notifications** on each phone or computer that should get them. This app
has no switch of its own, so each device gets one set. On an iPhone, first add the site to
the home screen (Share > Add to Home Screen) and open it from there; iOS only
allows push for installed sites. After that, each new alert makes the
database call `/api/alerts/push` (pg_net, with the `cron_secret` from
`private.app_settings`), which emails it and sends it with `web-push` to every
device saved in `push_subscriptions`. Devices the push service reports as gone
are removed. If that call is missed (say, during a deploy), the daily job
sends the alert the next morning.

The push key pair (VAPID) is saved in `private.app_settings` (`vapid_public_key`,
`vapid_private_key`); nothing needs setting in Vercel beyond `CRON_SECRET`.
Don't replace the keys: every device would have to turn push on again.

## Maintenance mode

While you're changing something big, set `MAINTENANCE_MODE` to `on` in Vercel (Settings -> Environment Variables) and redeploy. Every page then shows "We're updating the site" (`/maintenance`) with a 503, instead of an error. The cron jobs and `/api/alerts/push` keep running, so reminders and alerts still go out. Delete the variable (or set it to anything else) and redeploy to turn it off. Missing pages show "Page not found" and crashes show "Something went wrong", both with a button to recover.

## Smoke check

Vercel deploys `main` on its own. After each push to `main`,
`.github/workflows/smoke.yml` waits (up to 10 minutes) for Vercel's
production deployment of that commit, then runs `e2e/smoke.spec.ts`
(Playwright) against the live site: the home page sends a logged-out visitor
to `/login` (so not the maintenance page), `/login` and `/privacy` load with
200, the brand shows, and no uncaught page errors (network failures reaching
Supabase are tolerated, and so is React's hydration warning #418, which
Cloudflare's Email Address Obfuscation causes on `/privacy`). A failed deploy or check fails the run, and GitHub
emails the person who pushed. To run it against a local build:

```bash
npm run build && npm start   # in one terminal
SMOKE_URL=http://localhost:3000 npx playwright test
```

(`npx playwright install chromium` once first.) Vitest doesn't pick it up.

## Tests

```bash
npm test             # run once
npm run test:watch   # rerun on save
```

- `src/lib/slots.test.ts`: the slot engine. Covers 15-minute starts, the
  end-of-window cutoff, the 72-hour approval rule, daylight saving, and overlap
  blocking. Runs in UTC, like the server on Vercel.
- `src/lib/calendar.test.ts`: the admin calendar's month and week days (weeks
  start Monday), open-hours windows across time zones and daylight saving, and
  side-by-side placement of overlapping classes.
- `src/lib/display-names.test.ts`: "First L." names and duplicate numbering.
- `src/components/slot-picker.test.tsx`: the booking picker as a student and
  as an admin, in a Mountain Time browser.
- `src/components/cancel-booking-dialog.test.tsx`: canceling, and the warning
  that a confirmed session canceled less than 24 hours ahead still counts.
- `src/components/admin/late-cancellations.test.tsx`: the admin's late
  cancellations list.
- `src/lib/notifications.test.ts` and `src/lib/google.test.ts`: which emails
  and calendar events each booking change produces (Google is stubbed out).
- `src/components/app-shell.test.tsx`: the header, admin navigation, the
  alerts bell, and settings menu.
- `src/lib/admin-push.test.ts`: the alert push messages and `/api/alerts/push`
  (web-push is stubbed out).

### Database tests

`supabase/tests/database.test.sql` checks the rules that actually protect the
data: students can't make themselves admin, can't confirm their own bookings,
can't write slots directly, and the booking functions refuse bad requests.
It runs in a single transaction that's rolled back at the end, so it's safe
against the live database.

Run it by pasting the file into the Supabase SQL editor. A pass ends with
`ALL DATABASE TESTS PASSED`; a failure stops with an error naming the check.
Run it after any change to the database.
