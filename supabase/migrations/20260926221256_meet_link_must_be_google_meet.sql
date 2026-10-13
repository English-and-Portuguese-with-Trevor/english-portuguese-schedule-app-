-- A student can record the meeting for their own booking, so only accept real
-- Google Meet links; anything else could put a look-alike link in the admin's
-- agenda email.
create or replace function public.set_booking_meeting(p_booking_id uuid, p_event_id text, p_meet_link text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_meet_link is not null and p_meet_link !~ '^https://meet\.google\.com/[a-z0-9-]+$' then
    raise exception 'Not a Google Meet link.';
  end if;

  update public.bookings
  set google_event_id = p_event_id,
      meet_link = p_meet_link
  where id = p_booking_id
    and (student_id = auth.uid() or public.is_admin())
    and google_event_id is null;
end;
$function$;
