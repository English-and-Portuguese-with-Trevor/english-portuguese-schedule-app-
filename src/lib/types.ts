import type { Tables } from "@/lib/supabase/database.types";

export type Role = "admin" | "student";
/** "granted" is set by Trevor by hand; "subscriber" will come from Stripe. */
export type LessonAccess = "none" | "granted" | "subscriber";
export type SlotStatus = "OPEN" | "CANCELLED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type Profile = Omit<Tables<"profiles">, "role" | "lesson_access"> & {
  role: Role;
  lesson_access: LessonAccess;
};
export type AvailabilityRule = Tables<"availability_rules">;
export type SessionSlot = Omit<Tables<"session_slots">, "status"> & { status: SlotStatus };
export type Booking = Omit<Tables<"bookings">, "status"> & { status: BookingStatus };

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Student requests starting sooner than this need admin approval; later ones are confirmed automatically. */
export const APPROVAL_WINDOW_HOURS = 72;

/** A confirmed session cancelled with less than this much notice still counts as a class. */
export const LATE_CANCEL_HOURS = 24;

/** Late cancellations stay on the admin's Bookings page for this long. */
export const LATE_CANCEL_LIST_DAYS = 7;

export type LessonLanguage = "ENGLISH" | "PORTUGUESE";

/** Answers to the booking questions a student fills in when booking. */
export interface BookingAnswers {
  language: LessonLanguage;
  /** Optional; empty when the student leaves it blank. */
  whatsapp: string;
}

/** Loose shape check; the database has the final say. */
export const WHATSAPP_PATTERN = /^\+?[0-9 ()./-]{6,25}$/;
