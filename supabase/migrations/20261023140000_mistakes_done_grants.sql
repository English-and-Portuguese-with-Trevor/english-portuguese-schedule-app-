-- The notebook's Mistakes tab failed with "permission denied for table
-- mistakes_done" (Trevor, 2026-10-23): logged-in users had lost the table's
-- select, insert and delete grants. Row-level security still decides whose
-- rows (20261017150000_mistakes_done.sql). Applied.
grant select, insert, delete on public.mistakes_done to authenticated;
