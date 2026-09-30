import { tr } from "@/i18n/translate";
import type { Tables } from "@/lib/supabase/database.types";

export type Role = "admin" | "student";
/**
 * "granted" and "lifetime" are set by Trevor by hand; "subscriber" comes from
 * the Stripe webhook. Lifetime is for students who finished three class sets.
 */
export type LessonAccess = "none" | "granted" | "subscriber" | "lifetime";

/** Class sets a student must finish to qualify for lifetime lesson access. */
export const LIFETIME_CLASS_SETS = 3;
export type ClassPackage = 4 | 8;

/** From the my_class_progress / admin_class_progress RPCs. */
export interface ClassProgress {
  user_id: string;
  class_package: ClassPackage | null;
  completed: number;
  needed: number | null;
  eligible: boolean;
}
export type SlotStatus = "OPEN" | "CANCELLED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type Profile = Omit<Tables<"profiles">, "role" | "lesson_access" | "class_package"> & {
  role: Role;
  lesson_access: LessonAccess;
  class_package: ClassPackage | null;
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

/** A confirmed session canceled with less than this much notice still counts as a class. */
export const LATE_CANCEL_HOURS = 24;

/** Late cancellations stay on the admin's Bookings page for this long. */
export const LATE_CANCEL_LIST_DAYS = 7;

/**
 * Why a student flags a class (flag_my_class): set reasons, no notes. Only
 * students with lesson access Trevor gave by hand can flag.
 */
export const FLAG_REASONS = {
  connection: tr("Connection or Meet problem"),
  booking: tr("Time or booking problem"),
  other: tr("Something else"),
} as const;
export type FlagReason = keyof typeof FLAG_REASONS;

/** How long after a class it can still be flagged (flag_my_class). */
export const FLAG_DAYS = 7;

export type LessonLanguage = "ENGLISH" | "PORTUGUESE";

/** Answers to the booking questions a student fills in when booking. */
export interface BookingAnswers {
  language: LessonLanguage;
  /** Optional; empty when the student leaves it blank. */
  whatsapp: string;
}

/** Loose shape check; the database has the final say. */
export const WHATSAPP_PATTERN = /^\+?[0-9 ()./-]{6,25}$/;
