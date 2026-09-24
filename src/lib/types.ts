import type { Tables } from "@/lib/supabase/database.types";

export type Role = "admin" | "student";
export type SlotStatus = "OPEN" | "CANCELLED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type Profile = Omit<Tables<"profiles">, "role"> & { role: Role };
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
