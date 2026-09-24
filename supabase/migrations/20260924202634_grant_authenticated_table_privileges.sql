-- Tables created via raw SQL migration don't get Supabase's default
-- anon/authenticated grants the way dashboard-created tables do. RLS
-- policies alone are not sufficient — Postgres also requires the base
-- table-level GRANT, which was missing entirely for these four tables,
-- silently breaking every query the app made against them.
grant select, insert, update, delete on public.availability_rules to authenticated;
grant select, insert, update, delete on public.recurring_groups to authenticated;
grant select, insert, update, delete on public.session_slots to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
