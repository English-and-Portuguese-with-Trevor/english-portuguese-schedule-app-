---
name: whatsapp-update
description: Write Trevor's WhatsApp class update for a private student from the Planilha dos alunos and their bookings, using docs/whatsapp-update.md. Use when Trevor asks for a WhatsApp text, class update or "mensagem" for a student after a class.
---

# WhatsApp class update

Student: $ARGUMENTS. Template and rules: `docs/whatsapp-update.md` (read it; it is the source). Background: CLAUDE.md "Planilha dos alunos".

## Steps

1. Read the student's row in the Google Sheet "Planilha dos alunos" (tab Página1: day, student, time in Denver, Meet link, classes done / package, status, start date, payment, language, notes, student time zone). The Google Sheets connector reads it; if it isn't connected, ask Trevor for the row.
2. Read their bookings in Supabase: the next CONFIRMED class after now (`bookings` joined to `session_slots`, `student_id` the student's profile; a hold sits on Trevor's own account with `notes` "Hold: <name>"), and the count done: past confirmed classes + late cancellations + `profiles.earlier_classes`. If the sheet and the database disagree, say so and use the sheet's count; Trevor fixes the other.
3. Fill the template in the language the student is learning only (`language` on the sheet), no translation under it:
   - The brand line, then the main site's address, then the schedule app's, before any other link.
   - Next class in the student's own time zone (the sheet's last column), e.g. "7:00 AM (Los Angeles time)", never Denver's unless they are in Denver.
   - Leave out the Meet link line when the student has none.
   - Package lines last, bold, in capitals between rules. When classes done reach the package, add the "package has ended" line from the template.
4. Give Trevor the text in one code block, ready to paste. Nothing is sent from here.

## Never
- Translate the text or add a second language.
- Send a message, email or push yourself.
