"use server";

import Anthropic from "@anthropic-ai/sdk";

import { askClaude, LIMITS, parseStudyNote, SONNET, studyNoteMessage, studyNotePrompt, turnCost } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerJobClient } from "@/lib/integration-status";
import type { LessonCatalog } from "@/lib/notifications";
import { siteFile } from "@/lib/site-files";

// The class notes writer (/admin/notes; CLAUDE.md "Class notes"): Trevor picks
// a student's class, his simple notes come back tidied with lessons to study,
// and he saves the note the student reads (class_notes).
const LESSON_LINK = "https://englishandportuguesewithtrevor.com/lessons/#/";

export type NoteClass = { id: string; start: string; notes: string | null };
export type StudyLink = { title: string; url: string; why: string };

type Row = { id: string; session_slots: { start_time: string }; class_notes: { notes: string } | { notes: string }[] | null };

/**
 * A student's classes that took place: the last four, or every one on a day
 * (`from`/`to`, the day's bounds on Trevor's device), newest first.
 */
export async function studentClasses(studentId: string, day?: { from: string; to: string }): Promise<NoteClass[]> {
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("bookings")
    .select("id, session_slots!inner(start_time), class_notes(notes)")
    .eq("student_id", studentId)
    .eq("status", "CONFIRMED");
  query = day
    ? query.gte("session_slots.start_time", day.from).lt("session_slots.start_time", day.to)
    : query.lt("session_slots.start_time", new Date().toISOString());
  const { data } = await query;
  return ((data ?? []) as unknown as Row[])
    .map((b) => {
      const note = Array.isArray(b.class_notes) ? b.class_notes[0] : b.class_notes;
      return { id: b.id, start: b.session_slots.start_time, notes: note?.notes ?? null };
    })
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, day ? undefined : 4);
}

/** Trevor's notes back as the student's note, with lessons on the site for the difficulties he noted. */
export async function draftClassNote(
  bookingId: string,
  notes: string,
): Promise<{ note: string; study: StudyLink[]; error: null } | { error: string }> {
  const { supabase, adminId } = await requireAdmin();
  const text = notes.trim();
  if (!text || text.length > LIMITS.classnoteChars) return { error: `Write your notes (at most ${LIMITS.classnoteChars} characters).` };

  const { data: booking } = await supabase.from("bookings").select("student_id").eq("id", bookingId).single();
  if (!booking) return { error: "That class wasn't found." };

  const db = createServerJobClient();
  const [{ data: student }, { data: settings }, { data: limitsData }, catalog] = await Promise.all([
    db.from("profiles").select("learning_language").eq("id", booking.student_id).single(),
    db.from("ai_settings").select("enabled, tools_cap").eq("id", true).single(),
    db.rpc("ai_limits", { p_user: adminId, p_conversation: bookingId }),
    siteFile<LessonCatalog>("lessons"),
  ]);
  if (!settings?.enabled || !process.env.ANTHROPIC_API_KEY) return { error: "The AI is switched off (AI tab on the admin dashboard)." };
  const limits = limitsData as { pool_cost: number } | null;
  if (!limits) return { error: "Something went wrong. Please try again." };
  if (Number(limits.pool_cost) >= Number(settings.tools_cap)) return { error: "The AI tools pool is used up." };

  // Only the language the student is learning (Portuguese when unset).
  const english = student?.learning_language === "English";
  const lessons = (catalog ?? []).filter((l) => (l.learning === "English") === english).map(({ id, title }) => ({ id, title }));

  const row = {
    user_id: adminId,
    feature: "classnote",
    conversation_id: crypto.randomUUID(),
    scene: bookingId,
    student: text,
    model: SONNET,
  };
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 60_000 });
    const answer = await askClaude(
      client,
      studyNotePrompt(),
      [{ role: "user", content: studyNoteMessage(text, lessons) }],
      LIMITS.classplanMaxTokens,
      SONNET,
    );
    const { error } = await db.from("ai_turns").insert({
      ...row,
      reply: answer.reply,
      input_tokens: answer.usage.input_tokens,
      cached_tokens: answer.usage.cache_read_input_tokens ?? 0,
      output_tokens: answer.usage.output_tokens,
      cost: turnCost(SONNET, answer.usage),
      stop_reason: answer.stopReason,
    });
    if (error) console.error("[class-notes] ledger insert failed:", error.message);
    if (answer.stopReason === "refusal" || !answer.reply) return { error: "The AI gave no note. Try rewording your notes." };
    const draft = parseStudyNote(answer.reply, lessons);
    return {
      note: draft.note,
      study: draft.study.map((s) => ({ title: s.title, url: LESSON_LINK + s.id, why: s.why })),
      error: null,
    };
  } catch (error) {
    console.error("[class-notes] failed:", error);
    await db.from("ai_turns").insert({ ...row, reply: "", stop_reason: "error" });
    return { error: "Something went wrong. Please try again." };
  }
}

/** Saves the note the student reads on their dashboard (one per class). */
export async function saveClassNote(bookingId: string, notes: string): Promise<{ error: string | null }> {
  const { supabase } = await requireAdmin();
  const text = notes.trim();
  if (!text) return { error: "The note is empty." };
  const { error } = await supabase
    .from("class_notes")
    .upsert({ booking_id: bookingId, notes: text, updated_at: new Date().toISOString() });
  return { error: error ? "Couldn't save the note. Please try again." : null };
}
