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

## Google Meet links and emails

Confirmed lessons become events on the englishportuguesewithtrevor@gmail.com
calendar with a Google Meet link, and the student is invited, so Google sends
them the invitation, changes, cancellations, and reminders. Other
notifications go out through that account's Gmail (see
`src/lib/notifications.ts` for the full list).

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

## Tests

```bash
npm test             # run once
npm run test:watch   # rerun on save
```

- `src/lib/slots.test.ts`: the slot engine. Covers 15-minute starts, the
  end-of-window cutoff, the 72-hour approval rule, daylight saving, and overlap
  blocking. Runs in UTC, like the server on Vercel.
- `src/lib/display-names.test.ts`: "First L." names and duplicate numbering.
- `src/components/slot-picker.test.tsx`: the booking picker as a student and
  as an admin, in a Mountain Time browser.
- `src/components/cancel-booking-dialog.test.tsx`: cancelling, and the warning
  that a confirmed session cancelled less than 24 hours ahead still counts.
- `src/components/admin/late-cancellations.test.tsx`: the admin's late
  cancellations list.
- `src/lib/notifications.test.ts` and `src/lib/google.test.ts`: which emails
  and calendar events each booking change produces (Google is stubbed out).
- `src/components/app-shell.test.tsx`: the header, admin navigation, and
  settings menu.

### Database tests

`supabase/tests/database.test.sql` checks the rules that actually protect the
data: students can't make themselves admin, can't confirm their own bookings,
can't write slots directly, and the booking functions refuse bad requests.
It runs in a single transaction that's rolled back at the end, so it's safe
against the live database.

Run it by pasting the file into the Supabase SQL editor. A pass ends with
`ALL DATABASE TESTS PASSED`; a failure stops with an error naming the check.
Run it after any change to the database.
