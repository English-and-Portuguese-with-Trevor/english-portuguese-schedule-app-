import { addDays, format, subDays } from "date-fns";
import { redirect } from "next/navigation";

import { BookingBoard } from "@/components/booking-board";
import { ClassNotes } from "@/components/class-notes";
import { ClassProgressCard } from "@/components/class-progress-card";
import { Homework } from "@/components/homework";
import { markHomework } from "@/lib/actions/homework";
import { checkAdmin } from "@/lib/auth/require-admin";
import { getDisplayNames } from "@/lib/display-names";
import { learningToLessonLanguage } from "@/lib/prefs";
import { generateUpcomingSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import { FLAG_DAYS, NEW_STUDENT_CLASS_MINUTES, isClassStudent } from "@/lib/types";
import type {
  AvailabilityRule,
  Booking,
  ClassProgress,
  LessonAccess,
  LessonLanguage,
  Role,
} from "@/lib/types";

const LOOKAHEAD_DAYS = 21;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, lesson_access, class_package, learning_language")
    .eq("id", user!.id)
    .single();
  const isAdmin = profile!.role === "admin";
  // Without the Google Authenticator code the database hides who booked each
  // class, so Trevor enters it first (on the admin dashboard, like /admin).
  if (isAdmin) {
    const check = await checkAdmin(supabase);
    if (!check.ok && check.reason === "needs-code") redirect("https://englishandportuguesewithtrevor.com/admin/");
  }
  // Students with lesson access can flag their classes.
  const canFlag = !isAdmin && ["granted", "subscriber", "lifetime"].includes(profile!.lesson_access);
  // Until Trevor marks them as his student, they book 30-minute classes.
  const shortClasses = !isAdmin && !isClassStudent(profile!);

  const now = new Date();
  const rangeEnd = addDays(now, LOOKAHEAD_DAYS);

  const [
    { data: rules },
    { data: slots },
    { data: myBookings },
    { data: lastAnswers },
    { data: progressRows },
    { data: recentClasses },
    { data: daysOff },
    { data: noteRows },
    { data: homeworkRows },
  ] = await Promise.all([
    supabase.from("availability_rules").select("*").eq("is_active", true),
    supabase
      .from("session_slots")
      .select("*")
      .eq("status", "OPEN")
      .gt("end_time", now.toISOString()) // include a session already in progress
      .lte("start_time", rangeEnd.toISOString()),
    // Upcoming only: a session that's over can't be canceled.
    supabase
      .from("bookings")
      .select("*, session_slots!inner(start_time, end_time)")
      .eq("student_id", profile!.id)
      .neq("status", "CANCELLED")
      .gt("session_slots.end_time", now.toISOString()),
    // Prefill the booking questions with the student's last answers.
    supabase
      .from("bookings")
      .select("lesson_language, whatsapp")
      .eq("student_id", profile!.id)
      .not("lesson_language", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Progress toward lifetime lesson access (three class sets).
    supabase.rpc("my_class_progress"),
    // Classes of the last FLAG_DAYS days, which can still be flagged.
    canFlag
      ? supabase
          .from("bookings")
          .select("*, session_slots!inner(start_time, end_time)")
          .eq("student_id", profile!.id)
          .eq("status", "CONFIRMED")
          .lte("session_slots.end_time", now.toISOString())
          .gt("session_slots.end_time", subDays(now, FLAG_DAYS).toISOString())
      : { data: [] },
    // Days off ending today or later (yesterday's UTC date covers today in Denver).
    supabase
      .from("availability_blocks")
      .select("starts_on, ends_on")
      .gte("ends_on", format(subDays(now, 1), "yyyy-MM-dd")),
    // Trevor's notes on the student's classes (class_notes).
    isAdmin
      ? { data: [] }
      : supabase
          .from("class_notes")
          .select("booking_id, notes, bookings!inner(student_id, session_slots!inner(start_time))")
          .eq("bookings.student_id", profile!.id)
          .order("updated_at", { ascending: false })
          .limit(20),
    // The homework Trevor gives on the student hub (homework), newest first.
    isAdmin
      ? { data: [] }
      : supabase.from("homework").select("id, text, done_at").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const notes = (noteRows ?? [])
    .map((n) => ({ bookingId: n.booking_id, start: n.bookings.session_slots.start_time, notes: n.notes }))
    .sort((a, b) => b.start.localeCompare(a.start));
  const progress = ((progressRows ?? []) as ClassProgress[])[0] ?? null;

  // Only admins see who booked a slot; students can't read other students'
  // bookings at all.
  type SlotBooking = { id: string; status: string; name: string; note: string | null; rescheduleOf: string | null };
  const studentBySlot = new Map<string, SlotBooking>();
  if (isAdmin && slots?.length) {
    const [{ data: activeBookings }, displayNames] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, status, session_slot_id, student_id, notes, reschedule_of")
        .in(
          "session_slot_id",
          slots.map((s) => s.id),
        )
        .neq("status", "CANCELLED"),
      getDisplayNames(supabase),
    ]);
    for (const b of activeBookings ?? [])
      studentBySlot.set(b.session_slot_id, {
        id: b.id,
        status: b.status,
        name: displayNames[b.student_id],
        note: b.notes,
        rescheduleOf: b.reschedule_of,
      });
  }

  // All candidate start times within active windows, including ones that
  // overlap a booking — the picker shows those struck through.
  const candidates = generateUpcomingSlots(
    (rules ?? []) as AvailabilityRule[],
    {
      now,
      days: LOOKAHEAD_DAYS,
      minutes: shortClasses ? NEW_STUDENT_CLASS_MINUTES : undefined,
      daysOff: daysOff ?? [],
    },
  );

  // Every OPEN slot is taken: canceling a booking cancels its slot, so a
  // slot only stays OPEN while it has an active booking.
  // A pending reschedule, by the class it would move: that class's row gets the answer buttons too.
  const moveOf = new Map<string, { pendingId: string; start: string }>();
  for (const s of slots ?? []) {
    const b = studentBySlot.get(s.id);
    if (b?.status === "PENDING" && b.rescheduleOf) moveOf.set(b.rescheduleOf, { pendingId: b.id, start: s.start_time });
  }
  const busySlots = (slots ?? []).map((s) => {
    const b = studentBySlot.get(s.id);
    return {
      start: s.start_time,
      end: s.end_time,
      studentName: b?.name,
      // e.g. "Hold: Tim" on a time held for a student with no account yet.
      note: b?.note ?? undefined,
      bookingId: b?.id,
      pending: b?.status === "PENDING",
      move: b && moveOf.get(b.id),
    };
  });

  return (
    <div className="flex flex-col gap-8">
      {!isAdmin && (
        <ClassProgressCard
          progress={progress}
          lessonAccess={profile!.lesson_access as LessonAccess}
        />
      )}
      <Homework items={(homeworkRows ?? []).map((h) => ({ id: h.id, text: h.text, doneAt: h.done_at }))} onMark={markHomework} />
      <ClassNotes notes={notes} />
      <BookingBoard
        role={profile!.role as Role}
        candidates={candidates.map((c) => ({
          start: c.start.toISOString(),
          end: c.end.toISOString(),
          needsApproval: c.needsApproval,
        }))}
        busySlots={busySlots}
        previousAnswers={{
          language:
            (lastAnswers?.lesson_language as LessonLanguage | null) ??
            learningToLessonLanguage(profile!.learning_language),
          whatsapp: lastAnswers?.whatsapp ?? undefined,
        }}
        canFlag={canFlag}
        shortClasses={shortClasses}
        recentClasses={
          (recentClasses ?? []).sort((a, b) =>
            b.session_slots.start_time.localeCompare(a.session_slots.start_time),
          ) as (Booking & { session_slots: { start_time: string; end_time: string } })[]
        }
        myBookings={
          (myBookings ?? []).sort((a, b) =>
            a.session_slots.start_time.localeCompare(
              b.session_slots.start_time,
            ),
          ) as (Booking & {
            session_slots: { start_time: string; end_time: string };
          })[]
        }
      />
    </div>
  );
}
