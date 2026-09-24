-- Prevent two concurrent booking requests from creating duplicate individual
-- slots at the same start time (the teacher only runs one 1:1 at a time).
create unique index if not exists session_slots_individual_start_unique
  on public.session_slots (start_time)
  where type = 'INDIVIDUAL';
