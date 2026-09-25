-- Booking questions: which language the student wants, and their WhatsApp.
alter table public.bookings
  add column lesson_language text check (lesson_language in ('ENGLISH', 'PORTUGUESE')),
  add column whatsapp text check (char_length(whatsapp) <= 32);

-- New optional answers; replace the function rather than overloading it.
drop function public.request_individual_booking(timestamptz, timestamptz, text);

create function public.request_individual_booking(
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default null,
  p_language text default null,
  p_whatsapp text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slot_id uuid;
  v_booking_id uuid;
  v_whatsapp text := nullif(trim(p_whatsapp), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_language is not null and p_language not in ('ENGLISH', 'PORTUGUESE') then
    raise exception 'Please choose English or Portuguese.';
  end if;

  if v_whatsapp is not null and v_whatsapp !~ '^\+?[0-9 ()./-]{6,25}$' then
    raise exception 'Please enter a valid WhatsApp number.';
  end if;

  if p_start <= now() then
    raise exception 'That time has already passed.';
  end if;

  if not exists (
    select 1 from public.availability_rules r
    where r.is_active
      and extract(dow from (p_start at time zone r.timezone)) = r.day_of_week
      and (p_start at time zone r.timezone)::date = (p_end at time zone r.timezone)::date
      and (p_start at time zone r.timezone)::time >= r.start_time
      and (p_end at time zone r.timezone)::time <= r.end_time
      and p_end - p_start = make_interval(mins => r.slot_duration_minutes)
      and mod(extract(epoch from ((p_start at time zone r.timezone)::time - r.start_time))::int, 900) = 0
  ) then
    raise exception 'That slot is no longer available.';
  end if;

  insert into public.session_slots (start_time, end_time, status)
  values (p_start, p_end, 'OPEN')
  returning id into v_slot_id;

  insert into public.bookings
    (session_slot_id, student_id, status, is_admin_override, student_timezone, lesson_language, whatsapp)
  values (
    v_slot_id,
    v_uid,
    case when p_start >= now() + interval '72 hours' then 'CONFIRMED' else 'PENDING' end,
    false,
    -- Only keep names Postgres recognizes, e.g. 'America/Sao_Paulo'.
    (select name from pg_timezone_names where name = p_timezone),
    p_language,
    v_whatsapp
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke execute on function public.request_individual_booking(timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.request_individual_booking(timestamptz, timestamptz, text, text, text) to authenticated;
