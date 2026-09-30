-- A student can take back a flag (a tap on the flagged class). The flag's
-- alert goes too, so a flag not emailed yet stays out of the morning email;
-- the class can then be flagged again.
create or replace function public.unflag_my_class(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
begin
  update public.bookings b
  set flag_reason = null
  from public.session_slots s
  where b.id = p_booking_id
    and s.id = b.session_slot_id
    and b.student_id = auth.uid()
    and b.flag_reason is not null
  returning s.start_time into v_start;

  if not found then
    raise exception 'Booking not found.';
  end if;

  delete from public.admin_alerts
  where kind = 'flag' and user_id = auth.uid() and class_start = v_start;
end;
$$;

revoke execute on function public.unflag_my_class(uuid) from public, anon;
grant execute on function public.unflag_my_class(uuid) to authenticated;
