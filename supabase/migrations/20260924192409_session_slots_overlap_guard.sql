-- Replace the exact-start-time uniqueness guard with a time-range overlap
-- guard: two OPEN individual sessions can never occupy overlapping time,
-- regardless of what 15-minute mark they start on.
create extension if not exists btree_gist;

drop index if exists public.session_slots_individual_start_unique;

alter table public.session_slots
  add constraint session_slots_individual_no_overlap
  exclude using gist (
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (type = 'INDIVIDUAL' and status = 'OPEN');
