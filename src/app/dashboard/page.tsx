import { addDays, format, subDays } from "date-fns";

import { BookingBoard } from "@/components/booking-board";
import { ClassNotes } from "@/components/class-notes";
import { ClassProgressCard } from "@/components/class-progress-card";
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
  ]);
  const notes = (noteRows ?? [])
    .map((n) => ({ bookingId: n.booking_id, start: n.bookings.session_slots.start_time, notes: n.notes }))
    .sort((a, b) => b.start.localeCompare(a.start));
  const progress = ((progressRows ?? []) as ClassProgress[])[0] ?? null;

  // Only admins see who booked a slot; students can't read other students'
  // bookings at all.
  const studentBySlot = new Map<string, string>();
  if (isAdmin && slots?.length) {
    const [{ data: activeBookings }, displayNames] = await Promise.all([
      supabase
        .from("bookings")
        .select("session_slot_id, student_id")
        .in(
          "session_slot_id",
          slots.map((s) => s.id),
        )
        .neq("status", "CANCELLED"),
      getDisplayNames(supabase),
    ]);
    for (const b of activeBookings ?? [])
      studentBySlot.set(b.session_slot_id, displayNames[b.student_id]);
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
  const busySlots = (slots ?? []).map((s) => ({
    start: s.start_time,
    end: s.end_time,
    studentName: studentBySlot.get(s.id),
  }));

  return (
    <div className="flex flex-col gap-8">
      {!isAdmin && (
        <ClassProgressCard
          progress={progress}
          lessonAccess={profile!.lesson_access as LessonAccess}
        />
      )}
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
