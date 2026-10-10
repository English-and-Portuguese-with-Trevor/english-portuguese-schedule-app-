# Decisions

The history behind the rules in `CLAUDE.md`: what Trevor decided, when, and why (his words where he gave them). The rules themselves stay in `CLAUDE.md`; this file says why they are the way they are, so a rule isn't re-litigated without knowing. Grouped under the same section titles.

## The ribbon style, readability first
- 2026-10-04/05: this app takes the look of the landing repo's home and About pages ("The ribbon style"): the sites' palette, Inter and DM Serif Display, glass cards, pill buttons, and the ribbons only behind a few surfaces (the login and status cards, the time picker panel), faint there so the words come first.
- 2026-10-05: readability wins over decoration: a notch bigger base size, no text on busy backgrounds, contrast kept.

## Account menu, Settings, lifetime access
- 2026-10-08: the account menu is kept compact, the same on every site; Home, My progress and My notes became one row of soft-colored buttons (green, teal and lavender, the same on every site).
- 2026-10-08: Settings reorganized into a short menu of pages, each holding one kind of thing, each opening on its own with nothing else under it.
- 2026-10-05: "What I use the app for" added to Settings (checkboxes, one "Opens here"), saved through `set_app_uses`.

## 30-minute classes for new students
- 2026-10-01: until Trevor marks someone as his student (lesson access `granted` or `lifetime`, or a class package) they can only book 30-minute classes; his students book the windows' full hour.
- 2026-10-10: a student may create at most 8 bookings in 24 hours, cancelled ones included (`assert_booking_limits`, `20261010030000_booking_change_limit.sql`): a book-and-cancel loop could flood Trevor's phone and the day's Gmail quota.

## Days off
- 2026-10-02: days off (`availability_blocks`) added on top of the weekly windows; classes already booked on a day off stay booked.

## Class notes
- 2026-10-03: after a class Trevor writes a few notes (what they covered, homework, new words) on the admin dashboard; the student reads them on the dashboard exactly as written. No email or push for them.

## My notes (students)
- 2026-10-05: every private student gets their own notes on the notebook site, set up like Google Docs' tabs (topics with sub-notes as deep as they like), with tags, a search box and a tag menu; "My notes" in every account menu right under My progress.
- 2026-10-06: private students means the students on the Planilha, so a `class_package` on the profile; admins too. Only a private student, an admin or an account with `profiles.notes_access` can start a note (`20261006000000_notes_for_private_students.sql`, `20261006020000_notes_access.sql`). Every account in the database that day got `notes_access`, testers and future students; new accounts start without it. It's not a class package, so no class emails or hour-long classes come with it. Anyone keeps the notes they have, so a student whose package ends keeps them until the cleanup.
- 2026-10-08: notes shared with Trevor (`20261008160000_shared_notes.sql`): everybody's notes are private unless they tick "Share with Trevor" on one; admins read and edit shared notes and nothing more; both type at once like a Google Doc (a Yjs document over the note's private Realtime channel).

## Admin alerts (new sign-ups, new subscribers)
- The push switch this app once had was removed: two switches (this app's and the admin dashboard's) meant two pushes per alert. Push is turned on only from the admin dashboard; this app has no push switch or service worker and must not get one back.
- 2026-10-08: class requests make `request` alerts (`20261008200000_class_request_alerts.sql`): a request came in and only the email told him. They're marked emailed when made, since "Approval needed" / "Reschedule requested" already email him.
- 2026-10-10: request alerts are pushed after the same one-minute wait as flags, so a request taken straight back is never pushed.
- 2026-10-10: the secret-guarded job functions and `admin_timezone` are executable by `service_role` only, with `check_cron_secret` as the second lock (`20261010040000_job_functions_service_role.sql`); the job routes call the database with `SUPABASE_SERVICE_ROLE_KEY` (`createServerJobClient`).
- The VAPID keys in `private.app_settings` were already made; never replace them.

## Daily practice reminder (students)
- 2026-10-08: students with lesson access can get one push a day for the activities site's daily practice (`20261008120000_daily_practice.sql`), in their site language, never once that day's set is done. A push, not an email (Email volume). The students' devices (`practice_push_subscriptions`) are kept apart from the admin's `push_subscriptions` so an admin alert never reaches a student.

## Admin emails
- 2026-10-02: the welcome email (`emails.welcome`), sent once to every new account: what's free, Get the app via `/?install=1`, Book a class. Accounts made before it existed were marked welcomed and never get it.
- 2026-10-05: no placement test line in the welcome email.

## Weekly summary
- 2026-10-02: the Monday weekly summary to Trevor (`emails.weeklySummary`, the `weekly_summary` RPC, `20261003010000_weekly_summary.sql`): the last 7 days in numbers, the week's classes, students quiet for 14+ days, in short names; admins' own practice isn't counted. A new number for Trevor goes here, not in a new email.
- 2026-10-04: it also shows the "Try something new" pills' week ("Suggestion pills") from the `pill_stats` RPC (`20261004020000_pill_events.sql`); if that call fails the section is left out.
- 2026-10-05: it also lists the articles released that day under "Share this week's articles", each with its share link (the lessons site's `lessons/a/<id>/` page, which previews in WhatsApp).

## Monthly summary (students)
- 2026-10-03: the students' monthly summary (`emails.monthlySummary`, `20261003081456_monthly_summary.sql`), wording approved by Trevor. It replaces nothing yet (Trevor: "not just yet").
- 2026-10-03: it goes only to students with `profiles.summary_delivery = 'email'` (the default; `set_email_choices`, `20261003105242_email_choices.sql`), and it's written in the student's site language while its content follows the learning language; the email template's tagline follows that language too (es and fr get their own line, pt the Portuguese one, English keeps English + Portuguese), the article emails pass it the same way, every other email keeps English + Portuguese.

## Article emails
- 2026-10-03: articles come out on Mondays (Denver); students who chose article emails (`article_delivery = 'email'`) get `emails.newArticles` that day, in their site language, with only the articles in the language they're learning. The other choices are "In the app" (the default) and Off.

## Weekly class update (students)
- 2026-10-03: every Sunday morning (Denver) each private student with a class in the coming week gets `emails.weeklyClassUpdate` (`20261003180000_weekly_class_update.sql`), in the language they're learning first and their own under it. Students turn it off with `class_update_delivery` (the third argument of `set_email_choices`, which the other sites don't send yet), and the footer says where: Trevor wanted the option fairly visible.

## Planilha dos alunos (Trevor's Google Sheet)
- 2026-10-03: Trevor keeps his private students' weekly times in the Google Sheet "Planilha dos alunos"; it's the source for the regulars' weekly times and the app mirrors it (a CONFIRMED admin-override booking per week through the end of the year, the package and classes done on the profile, lesson access `granted` or `lifetime`). A change he tells Claude goes to both places in the same step.
- 2026-10-03: students on the sheet with no account yet are held as CONFIRMED bookings on Trevor's own student account (trevorlister23@gmail.com) with `notes` "Hold: <name>": he wants them on the calendar. The calendars and lists show a booking's `notes` in small text after the name so he sees who the time is for. The admin nav's first tab, Today, opens the booking board (the installed app's start page), which Trevor likes for a day's classes at a glance.
- 2026-10-03: WhatsApp updates are written in the language the student is learning only, no translation under it.
- 2026-10-05: the WhatsApp template was saved as `docs/whatsapp-update.md` so it's pulled up the same way each time.
- 2026-10-05: the main site's address, then the schedule app's, go right under the brand line, before any other link: WhatsApp previews the first link in a message.
- 2026-10-03: the main site's Open Graph image (landing repo's `og-image.jpg`), like this app's (`src/app/opengraph-image.jpg`), is Trevor's logo, so a WhatsApp preview shows it instead of Google Meet's.

## Time zones
- 2026-10-08: Trevor sees every time in Denver (his devices are in Denver), students see theirs; `profiles.timezone` follows the browser a student books from (`bookings_profile_timezone`, `20261008210000_profile_timezone_from_bookings.sql`) and is Denver until then.

## Class policy and legal lines
- 2026-10-03: `/policy` is the class policy students agree to by booking. No refunds on private class packages: they finish the package; nothing said about expiry. Lesson subscriptions: cancel anytime, access to the end of the paid period, no refunds: Trevor doesn't want to offer any. Adults only (a parent or guardian creates and manages a minor's account), said on the policy page, the privacy page and the landing site's sign-up form.

## Email volume
- 2026-10-02: Trevor: "I don't want email overload." Fold a new email into one that already goes out (the daily agenda, the 6:30 AM flags summary, the Monday weekly summary); no marketing, newsletters or nudges unless he asks.

## DeepL translations
- 2026-09-30: DeepL is on hold, so the daily job's monthly "DeepL credits reset" email is off (`DEEPL_ON_HOLD` in `src/lib/daily-job.ts`) until Trevor says so.

## Portuguese and English stay separate
- 2026-09-28: Trevor's rule for every site: everything students practice is split by the language they're learning; never both in one list, never from a Portuguese activity straight into an English one.

## One address, one app
- 2026-10-02: this app stays at `schedule.englishandportuguesewithtrevor.com` (Vercel), outside the other sites' installed app, so it's its own installable app, "EPT Schedule".
- Trevor wants "App start" in the main account menu, not under Settings.

## Brand in the header
- 2026-09-29: Trevor chose the two-line brand ("English & Portuguese" over "with Trevor", the ampersand in gold italic) for every page of every site.
- 2026-10-03: a three-line menu icon was put before the name on the account button: students didn't see it was a menu.

## Working with Trevor
- 2026-10-10: SQL Trevor has to run himself goes in the chat as one code block, never as a file, unless he says otherwise.
- 2026-10-10: credits: work in the one repo the task needs, read only the files the change touches, no subagents or whole-site audits unless he asks, short replies with no restated plans or diff summaries.
