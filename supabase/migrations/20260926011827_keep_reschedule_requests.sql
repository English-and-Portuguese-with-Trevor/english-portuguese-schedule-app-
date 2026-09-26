-- Pending requests are only ever resolved by the admin: cancelling a lesson
-- no longer withdraws its pending reschedule request automatically.
drop trigger if exists trg_cancel_pending_reschedules on public.bookings;
drop function if exists public.cancel_pending_reschedules();
