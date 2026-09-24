-- Flag a student's late cancellation: a confirmed session cancelled less than
-- 24 hours before it starts still counts as a class. Set only here, when the
-- student cancels; an admin cancelling or declining never sets it.
alter table public.bookings
  add column late_cancellation boolean not null default false;

create or replace function public.cancel_my_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- In SET, b.status is the value before this update.
  update public.bookings b
  set status = 'CANCELLED',
      cancelled_at = now(),
      late_cancellation = (b.status = 'CONFIRMED' and s.start_time < now() + interval '24 hours')
  from public.session_slots s
  where b.id = p_booking_id
    and s.id = b.session_slot_id
    and b.student_id = auth.uid()
    and b.status <> 'CANCELLED';

  if not found then
    raise exception 'Booking not found.';
  end if;
end;
$$;
