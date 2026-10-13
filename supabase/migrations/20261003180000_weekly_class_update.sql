-- Weekly class update (Trevor, 2026-10-03): every Sunday morning the daily
-- job emails each private student (a class package set) who has a class in
-- the coming week their classes with the Meet links, classes completed and
-- what's left in the package, in the language they're learning first and
-- their own language under it. Students turn it off in Settings >
-- Preferences > Emails (class_update_delivery; the email says how).
-- claim_class_updates marks profiles.class_update_week first, so each week's
-- email goes once; a failed email is handed back with unclaim_class_updates.

alter table public.profiles
  add column if not exists class_update_delivery text not null default 'email' check (class_update_delivery in ('email', 'off')),
  add column if not exists class_update_week date;

-- set_email_choices gains a three-argument version for this app's Settings.
-- The two-argument one stays as it is for the other sites, which don't send
-- the third choice yet (no default here, or a two-argument call would match
-- both).
create or replace function public.set_email_choices(p_articles text, p_summary text, p_class_update text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_articles not in ('email', 'app', 'off') or p_summary not in ('email', 'off') or p_class_update not in ('email', 'off') then
    raise exception 'Unsupported email choice';
  end if;
  update public.profiles
  set article_delivery = p_articles,
      summary_delivery = p_summary,
      class_update_delivery = p_class_update
  where id = auth.uid();
end;
$$;
revoke execute on function public.set_email_choices(text, text, text) from public, anon;
grant execute on function public.set_email_choices(text, text, text) to authenticated;

create or replace function public.claim_class_updates(p_secret text, p_week date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := p_week::timestamp at time zone 'America/Denver';
  v_to timestamptz := (p_week + 7)::timestamp at time zone 'America/Denver';
  v_people jsonb;
begin
  perform private.check_cron_secret(p_secret);

  with claimed as (
    update public.profiles p
    set class_update_week = p_week
    where p.role <> 'admin'
      and p.email is not null
      and p.class_package is not null
      and p.class_update_delivery = 'email'
      and (p.class_update_week is null or p.class_update_week < p_week)
      and exists (
        select 1 from public.bookings b join public.session_slots s on s.id = b.session_slot_id
        where b.student_id = p.id and b.status = 'CONFIRMED' and s.start_time >= v_from and s.start_time < v_to
      )
    returning p.id, p.full_name, p.email, p.timezone, p.site_language, coalesce(p.learning_language, 'Portuguese') as learning
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'full_name', c.full_name,
    'email', c.email,
    'timezone', c.timezone,
    'site_language', c.site_language,
    'learning', c.learning,
    'week', p_week,
    'class_package', (select cp.class_package from private.class_progress(c.id) cp),
    'completed', (select cp.completed from private.class_progress(c.id) cp),
    'classes', (
      select coalesce(jsonb_agg(jsonb_build_object('start', s.start_time, 'end', s.end_time, 'meet_link', b.meet_link) order by s.start_time), '[]'::jsonb)
      from public.bookings b join public.session_slots s on s.id = b.session_slot_id
      where b.student_id = c.id and b.status = 'CONFIRMED' and s.start_time >= v_from and s.start_time < v_to
    )
  )), '[]'::jsonb)
  into v_people
  from claimed c;

  return v_people;
end;
$$;

create or replace function public.unclaim_class_updates(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(p_secret);
  update public.profiles set class_update_week = null where id = any(p_ids);
end;
$$;

-- Like the other job functions: anyone may call, the secret guards them.
revoke execute on function public.claim_class_updates(text, date) from public;
revoke execute on function public.unclaim_class_updates(text, uuid[]) from public;
grant execute on function public.claim_class_updates(text, date) to anon, authenticated;
grant execute on function public.unclaim_class_updates(text, uuid[]) to anon, authenticated;
