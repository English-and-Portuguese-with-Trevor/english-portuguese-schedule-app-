-- This permissive policy was OR'd with the pre-existing admin-only
-- profiles_update policy, letting any user update their own row —
-- including role — i.e. self-promote to admin. Nothing needs self-edit.
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
