-- Trevor's windows are in Mountain Time, and the Availability form starts on
-- America/Denver; the column default said Los Angeles. Make them agree.
alter table public.availability_rules
  alter column timezone set default 'America/Denver';
