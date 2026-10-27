---
name: whatsapp-update
description: Write Trevor's WhatsApp class update for a private student from the Planilha dos alunos and their bookings, using docs/whatsapp-update.md. Use when Trevor asks for a WhatsApp text, class update or "mensagem" for a student after a class.
---

# WhatsApp class update

Student: $ARGUMENTS. Template and rules: `docs/whatsapp-update.md` (read it; it is the source). Background: CLAUDE.md "Planilha dos alunos".

## Steps

1. Read the student's row in the Google Sheet "Planilha dos alunos" (tab Página1: day, student, time in Denver, Meet link, classes done / package, status, start date, payment, language, notes, student time zone). The Google Sheets connector reads it; if it isn't connected, ask Trevor for the row.
2. Read their bookings in Supabase: the next CONFIRMED class after now (`bookings` joined to `session_slots` on `session_slot_id`, `student_id` the student's profile; a hold sits on Trevor's own account with `notes` "Hold: <name>"), and the count done: past confirmed classes (`end_time` before now) + late cancellations (`late_cancellation`) + `profiles.earlier_classes`, the app's total; classes done in this package = that total modulo the package, the package itself when it divides (`packageClasses` in the landing repo's `src/lib/whatsappUpdate.js`). Count the class just taught as done. If the sheet and the database disagree, say so in the reply with both numbers and go with the sheet unless Trevor says which is right; then make the other match (step 5).
3. Fill the template in the language the student is learning only (`language` on the sheet), no translation under it:
   - The brand line, then the main site's address, then the schedule app's, before any other link.
   - Next class in the student's own time zone (the sheet's last column), e.g. "7:00 AM (Los Angeles time)", never Denver's unless they are in Denver.
   - Leave out the Meet link line when the student has none.
   - Package lines last, bold, in capitals between rules. When classes done reach the package, add the "package has ended" line from the template.
4. Give Trevor the text in one code block, ready to paste. Nothing is sent from here.
5. Make everything match what Trevor said, in the same step, so the sheet, the database and the text agree:
   - The sheet: write the new "Aulas feitas" (e.g. "4 / 8") in every row the student has (a student with two weekly times has two rows), and anything he said about the class in the Notas column (a late cancellation, a move, "Free cancel used <date>"). If the Google Sheets connector can't write, give him the cells to change.
   - The database: the bookings since the package started are usually right (a class that happened is CONFIRMED and past, one that counted is `late_cancellation`); when the bookings are right and the total is still off, fix `profiles.earlier_classes` so the total modulo the package equals the sheet's count; a missing class or a cancellation marked wrong is fixed on its booking instead. Check the count again after the change.

## Never
- Translate the text or add a second language.
- Send a message, email or push yourself.
