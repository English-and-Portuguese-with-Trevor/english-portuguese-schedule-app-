-- The lessons repo's deploy step uploads paid lesson text with the service role key.
grant select, insert, update, delete on public.lesson_content to service_role;
