-- Class requests waiting for approval push Trevor (2026-10-08: a request
-- came in and only the email told him). A student's booking or reschedule
-- that lands as PENDING makes a 'request' admin alert, pushed at once like a
-- sign-up (admin_alerts_request_push). It's marked emailed right away: the
-- schedule app already sends "Approval needed" / "Reschedule requested".

alter table public.admin_alerts drop constraint if exists admin_alerts_kind_check;
alter table public.admin_alerts
  add constraint admin_alerts_kind_check check (kind in ('signup', 'subscriber', 'flag', 'report', 'request'));

create or replace function private.alert_class_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'PENDING' and not new.is_admin_override then
    insert into public.admin_alerts (kind, user_id, name, email, reason, class_start, emailed_at)
    select 'request', p.id, p.full_name, p.email,
           case when new.reschedule_of is not null then 'reschedule' end,
           s.start_time, now()
    from public.profiles p, public.session_slots s
    where p.id = new.student_id and s.id = new.session_slot_id;
  end if;
  return new;
exception when others then
  -- An alert is never worth failing a booking over.
  raise warning 'alert_class_request: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function private.alert_class_request() from public, anon, authenticated;

drop trigger if exists bookings_alert_class_request on public.bookings;
create trigger bookings_alert_class_request
  after insert on public.bookings
  for each row execute function private.alert_class_request();
