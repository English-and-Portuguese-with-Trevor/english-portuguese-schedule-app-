import { tr } from "@/i18n/translate";

// Errors students can get back from the booking database functions
// (supabase/migrations) and the billing and delete-account edge functions
// (flashcards-app repo). Listed so they get translations; they're shown
// with t(message).
export const SERVER_MESSAGES = [
  tr("Booking not found."),
  tr("Classes can be booked up to 60 days ahead."),
  tr("Classes must be requested at least 72 hours in advance."),
  tr("Only a confirmed lesson can be rescheduled."),
  tr("Please choose English or Portuguese."),
  tr("Please enter a valid WhatsApp number."),
  tr("Sessions must be requested at least 72 hours in advance."),
  tr("That class is no longer available."),
  tr("That slot is no longer available."),
  tr("That time has already passed."),
  tr("This lesson has already started."),
  tr("You already asked to reschedule this lesson."),
  tr("You already flagged this class."),
  tr("Please pick a reason."),
  tr("You already have 10 upcoming classes. Cancel one to book another."),
  tr("That's a lot of booking changes for one day. Please try again tomorrow or write to Trevor."),
  tr("Admin accounts can't be self-deleted from the app."),
  tr(
    "You have an upcoming class booked. Cancel it in the schedule app first, then delete your account.",
  ),
  tr("Please log in first."),
  tr("Something went wrong with billing. Please try again."),
];
