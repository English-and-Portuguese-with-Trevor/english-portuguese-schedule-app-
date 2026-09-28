-- Only the server records a booking's Google Meet link. The old version was
-- callable by the student on their own booking, so a student could pre-fill a
-- Meet link on a pending request and the server's later write (which only
-- fills an empty google_event_id) was silently ignored. The server now proves
-- itself with the job secret (private.app_settings 'cron_secret'), the same
-- way record_integration_status and claim_student_reminders do.
drop function if exists public.set_booking_meeting(uuid, text, text);

create or replace function public.set_booking_meeting(p_booking_id uuid, p_event_id text, p_meet_link text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);

  if p_meet_link is not null and p_meet_link !~ '^https://meet\.google\.com/[a-z0-9-]+$' then
    raise exception 'Not a Google Meet link.';
  end if;

  update public.bookings
  set google_event_id = p_event_id,
      meet_link = p_meet_link
  where id = p_booking_id
    and google_event_id is null;
end;
$$;
