-- Flags: subscribers can flag their classes too, and flagged classes are
-- emailed once a morning instead of one by one (/api/cron/flags; push and
-- the Alerts page still get them at once). emailed_at marks a flag as sent.

alter table public.admin_alerts add column if not exists emailed_at timestamptz;

create or replace function public.flag_my_class(p_booking_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
begin
  if p_reason is null or p_reason not in ('connection', 'booking', 'other') then
    raise exception 'Please pick a reason.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lesson_access in ('granted', 'subscriber', 'lifetime')
  ) then
    raise exception 'Booking not found.';
  end if;

  -- One flag per class: the reason is saved on the student's own booking.
  update public.bookings b
  set flag_reason = p_reason
  from public.session_slots s
  where b.id = p_booking_id
    and s.id = b.session_slot_id
    and b.student_id = auth.uid()
    and b.status = 'CONFIRMED'
    and b.flag_reason is null
    and s.end_time > now() - interval '7 days'
  returning s.start_time into v_start;

  if not found then
    if exists (select 1 from public.bookings where id = p_booking_id and student_id = auth.uid() and flag_reason is not null) then
      raise exception 'You already flagged this class.';
    end if;
    raise exception 'Booking not found.';
  end if;

  insert into public.admin_alerts (kind, user_id, name, email, reason, class_start)
  select 'flag', p.id, p.full_name, p.email, p_reason, v_start
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

-- Marks the flags not emailed yet as emailed and returns them, oldest first.
create or replace function public.claim_flag_digest(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flags jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with claimed as (
    update public.admin_alerts
    set emailed_at = now()
    where kind = 'flag' and emailed_at is null
    returning id, kind, name, email, reason, class_start, created_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.id), '[]'::jsonb)
  into v_flags
  from claimed;

  return v_flags;
end;
$$;

revoke execute on function public.claim_flag_digest(text) from public;
grant execute on function public.claim_flag_digest(text) to anon, authenticated;
