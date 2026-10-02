-- Approving a request in one step (Trevor, 2026-10-02): confirming a
-- reschedule and canceling the class it replaces happen together, so a
-- student can never end up holding both. Admins only. Returns what happened:
--   'not_pending'        nothing changed (already approved, declined or gone)
--   'approved'           a new booking, nothing to replace
--   'original_canceled'  a reschedule whose original was canceled meanwhile
--   'rescheduled'        the new time is confirmed and the original canceled
-- Trevor ran this in the SQL editor.

create or replace function public.approve_booking(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original uuid;
  v_original_status text;
begin
  if not private.is_admin() then
    raise exception 'Admin only.';
  end if;

  update public.bookings set status = 'CONFIRMED'
  where id = p_booking_id and status = 'PENDING'
  returning reschedule_of into v_original;
  if not found then
    return 'not_pending';
  end if;

  if v_original is null then
    return 'approved';
  end if;

  select status into v_original_status from public.bookings where id = v_original for update;
  if v_original_status is null or v_original_status = 'CANCELLED' then
    return 'original_canceled';
  end if;

  update public.bookings
  set status = 'CANCELLED', cancelled_at = now(), cancellation_reason = 'Rescheduled'
  where id = v_original;
  return 'rescheduled';
end;
$$;

revoke execute on function public.approve_booking(uuid) from public, anon;
grant execute on function public.approve_booking(uuid) to authenticated;
