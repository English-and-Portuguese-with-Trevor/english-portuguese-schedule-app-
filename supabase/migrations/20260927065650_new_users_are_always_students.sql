-- Sign-up metadata is written by the person signing up (email sign-up lets
-- them send any fields), so it must never decide the role. Every new account
-- is a student; only an admin can promote someone on the Users page.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''), 100),
    'student'
  )
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$function$;
