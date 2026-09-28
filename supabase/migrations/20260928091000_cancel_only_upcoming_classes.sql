-- A class that has started (or finished) can't be cancelled by the student any
-- more: it counts as taken. Before this, cancel_my_booking accepted any
-- non-cancelled booking, however old.
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    and b.status <> 'CANCELLED'
    and s.start_time > now();

  if not found then
    if exists (
      select 1
      from public.bookings b
      join public.session_slots s on s.id = b.session_slot_id
      where b.id = p_booking_id
        and b.student_id = auth.uid()
        and b.status <> 'CANCELLED'
    ) then
      raise exception 'This lesson has already started.';
    end if;
    raise exception 'Booking not found.';
  end if;
end;
$$;
