import type { Tables } from "@/lib/supabase/database.types";

export type Role = "admin" | "student";
export type SlotType = "INDIVIDUAL" | "RECURRING_CLASS";
export type SlotStatus = "OPEN" | "CANCELLED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type Profile = Omit<Tables<"profiles">, "role"> & { role: Role };
export type AvailabilityRule = Tables<"availability_rules">;
export type RecurringGroup = Tables<"recurring_groups">;
export type SessionSlot = Omit<Tables<"session_slots">, "type" | "status"> & {
  type: SlotType;
  status: SlotStatus;
};
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

export const BOOKING_CUTOFF_HOURS = 72;
