---
name: new-student
description: Mirror a new private student (or a sheet change) from the Planilha dos alunos into the schedule app's database: profile package and classes done, lesson access, weekly CONFIRMED bookings with the Meet link, holds moved off Trevor's account. Use when Trevor adds a student to the sheet, changes a weekly time, or a held student signs up.
---

# New private student (sheet → database)

Student: $ARGUMENTS. Rules: CLAUDE.md "Planilha dos alunos", "30-minute classes for new students", "Days off". A change Trevor tells you goes to both the sheet and the database in the same step. SQL Trevor runs himself goes in the chat as one code block.

## Steps

1. Read the student's row in "Planilha dos alunos" (day, time in Denver, Meet link, classes done / package, language, time zone, notes). If a detail is missing, ask Trevor before writing anything.
2. Find the profile (`profiles` by email). No account yet: the times are **holds** on Trevor's own student account (trevorlister23@gmail.com) with `notes` "Hold: <name>" and `reminder_sent_at` set so no reminder goes out, and their hours kept out of the availability windows; when the student signs up, move the holds' `student_id` to the new profile and clear the hold note.
3. Profile: `class_package` (4 or 8), `earlier_classes` (classes done before the app), `lesson_access` `granted` (or `lifetime` when Trevor says so; never automatically). A class package is what makes them a private student (1-hour bookings, class emails, My notes).
4. Weekly classes through the end of the year: for each week, one `session_slots` row (`type` INDIVIDUAL, start and end in Denver time as `timestamptz`, 60 minutes) and one `bookings` row (`status` CONFIRMED, `is_admin_override` true, `meet_link` from the sheet, `student_timezone` the student's zone). Skip days off (`availability_blocks`) and clashes with existing bookings; list what you skipped. Write straight into the database: no emails are sent this way, which is what Trevor wants for sheet mirrors.
5. A class that didn't happen: cancel it as late (counts toward the package) or on time (doesn't), as Trevor says.
6. Update the sheet to match (classes done, status: Paid while the package is in progress, Not Paid once used up or when Trevor says so).
7. Check: the admin Calendar (landing dashboard) and `/dashboard` show the bookings with any `notes` after the name; `my_class_progress` for the student gives the right "done of package".

## Never
- Grant `lifetime` on your own; Trevor gives it by hand.
- Book through the app's actions for a sheet mirror (that would email the student per class).
- Change `profiles.timezone` from Trevor's own bookings.
