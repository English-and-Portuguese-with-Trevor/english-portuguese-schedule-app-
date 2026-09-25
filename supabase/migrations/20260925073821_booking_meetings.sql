-- Each confirmed lesson gets a Google Calendar event with a Meet link.
alter table public.bookings
  add column google_event_id text,
  add column meet_link text;

-- Students can't update bookings directly, so the server stores the event
-- for a student's own booking through this. It only fills an empty slot:
-- an event that's already recorded can't be overwritten.
create or replace function public.set_booking_meeting(p_booking_id uuid, p_event_id text, p_meet_link text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings
  set google_event_id = p_event_id,
      meet_link = p_meet_link
  where id = p_booking_id
    and (student_id = auth.uid() or public.is_admin())
    and google_event_id is null;
end;
$$;

revoke execute on function public.set_booking_meeting(uuid, text, text) from public, anon;
grant execute on function public.set_booking_meeting(uuid, text, text) to authenticated;
