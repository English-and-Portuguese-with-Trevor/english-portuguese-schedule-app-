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

## Tests

```bash
npm test             # run once
npm run test:watch   # rerun on save
```

- `src/lib/slots.test.ts`: the slot engine. Covers 15-minute starts, the
  end-of-window cutoff, the 72-hour rule, daylight saving, and overlap
  blocking. Runs in UTC, like the server on Vercel.
- `src/lib/display-names.test.ts`: "First L." names and duplicate numbering.
- `src/components/slot-picker.test.tsx`: the booking picker as a student and
  as an admin, in a Mountain Time browser.

### Database tests

`supabase/tests/database.test.sql` checks the rules that actually protect the
data: students can't make themselves admin, can't confirm their own bookings,
can't write slots directly, and the booking functions refuse bad requests.
It runs in a single transaction that's rolled back at the end, so it's safe
against the live database.

Run it by pasting the file into the Supabase SQL editor. A pass ends with
`ALL DATABASE TESTS PASSED`; a failure stops with an error naming the check.
Run it after any change to database policies or functions.
