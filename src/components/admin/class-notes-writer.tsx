"use client";

import { addDays, format } from "date-fns";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { draftClassNote, saveClassNote, studentClasses, type NoteClass, type StudyLink } from "@/lib/actions/class-notes";

const field =
  "w-full rounded-xl border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** The note the student reads, with the suggested lessons under it (links stay plain text on their dashboard). */
function withStudy(note: string, study: StudyLink[]) {
  if (study.length === 0) return note;
  return `${note}\n\nEstudo sugerido / Suggested study\n${study.map((s) => `- ${s.title}: ${s.why}\n  ${s.url}`).join("\n")}`;
}

/**
 * Trevor's class notes writer (admin only): a student, one of their last four
 * classes (or any class on a picked date), his simple notes, then the AI's
 * tidy note with suggested study from the lessons site, edited before saving.
 */
export function ClassNotesWriter({ students }: { students: { id: string; name: string }[] }) {
  const [studentId, setStudentId] = useState("");
  const [classes, setClasses] = useState<NoteClass[] | null>(null);
  const [date, setDate] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [notes, setNotes] = useState("");
  const [study, setStudy] = useState<StudyLink[]>([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(id: string, day?: string) {
    setBookingId("");
    setDraft("");
    setStudy([]);
    setMessage(null);
    setClasses(null);
    if (!id) return;
    startTransition(async () => {
      // The picked date's bounds on this device (Trevor's, in Denver).
      const start = day ? new Date(`${day}T00:00`) : null;
      const range = start ? { from: start.toISOString(), to: addDays(start, 1).toISOString() } : undefined;
      setClasses(await studentClasses(id, range));
    });
  }

  function pick(c: NoteClass) {
    setBookingId(c.id);
    setNotes("");
    setStudy([]);
    setDraft(c.notes ?? "");
    setMessage(null);
  }

  function generate() {
    setMessage(null);
    startTransition(async () => {
      const result = await draftClassNote(bookingId, notes);
      if (result.error !== null) return setMessage(result.error);
      setStudy(result.study);
      setDraft(withStudy(result.note, result.study));
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const { error } = await saveClassNote(bookingId, draft);
      setMessage(error ?? "Saved. The student sees it under Notes from Trevor.");
      if (!error) setClasses((list) => list?.map((c) => (c.id === bookingId ? { ...c, notes: draft.trim() } : c)) ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes-student">Student</Label>
        <select
          id="notes-student"
          className={`${field} h-11`}
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setDate("");
            load(e.target.value);
          }}
        >
          <option value="">Choose a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {studentId && (
        <div className="flex flex-col gap-2">
          <Label>{date ? "Classes that day" : "Last four classes"}</Label>
          {classes === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{date ? "No class on that date." : "No past classes yet."}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <Button key={c.id} type="button" size="sm" variant={c.id === bookingId ? "default" : "outline"} onClick={() => pick(c)}>
                  {format(new Date(c.start), "EEE, MMM d, h:mm a")}
                  {c.notes ? " ✓" : ""}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="notes-date" className="text-sm font-normal text-muted-foreground">
              Older class:
            </Label>
            <Input
              id="notes-date"
              type="date"
              className="h-9 w-auto"
              value={date}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => {
                setDate(e.target.value);
                load(studentId, e.target.value || undefined);
              }}
            />
            {date && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setDate("");
                  load(studentId);
                }}
              >
                Back to the last four
              </Button>
            )}
          </div>
        </div>
      )}

      {bookingId && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes-simple">Your notes</Label>
            <textarea
              id="notes-simple"
              className={field}
              rows={6}
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="covered ser vs estar, struggled w/ estar for location, hw: write 5 sentences, new words: cansado, feliz"
            />
            <Button type="button" className="self-start" disabled={pending || !notes.trim()} onClick={generate}>
              {pending ? "Working…" : "Clean up and suggest study"}
            </Button>
          </div>

          {study.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>Suggested study</Label>
              <ul className="list-disc pl-5 text-sm">
                {study.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.title}
                    </a>
                    : {s.why}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes-draft">Note for the student</Label>
            <textarea id="notes-draft" className={field} rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="button" variant="gold" className="self-start" disabled={pending || !draft.trim()} onClick={save}>
              Save note
            </Button>
          </div>
        </>
      )}

      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
