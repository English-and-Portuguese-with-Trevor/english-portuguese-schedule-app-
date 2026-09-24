-- Scheduling app schema
-- Extends the existing shared `profiles` table and adds scheduling-specific tables.

-- 1. Extend profiles (additive, non-breaking for other apps sharing this table)
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists timezone text not null default 'America/Los_Angeles',
  add column if not exists phone text;

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'student'));

-- 2. Admin base availability (recurring weekly windows for 1:1 booking)
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_duration_minutes smallint not null default 45 check (slot_duration_minutes > 0),
  timezone text not null default 'America/Los_Angeles',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint availability_time_order check (end_time > start_time)
);

-- 3. Recurring class series (parent record)
create table if not exists public.recurring_groups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  timezone text not null default 'America/Los_Angeles',
  starts_on date not null,
  ends_on date,
  max_capacity smallint not null default 6 check (max_capacity > 0),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4. Concrete bookable time blocks (both 1:1 instances and recurring class instances)
create table if not exists public.session_slots (
  id uuid primary key default gen_random_uuid(),
  start_time timestamptz not null,
  end_time timestamptz not null,
  type text not null check (type in ('INDIVIDUAL', 'RECURRING_CLASS')),
  max_capacity smallint not null default 1 check (max_capacity > 0),
  recurring_group_id uuid references public.recurring_groups(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN', 'CANCELLED')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint session_time_order check (end_time > start_time),
  constraint recurring_group_required check (
    (type = 'RECURRING_CLASS' and recurring_group_id is not null)
    or (type = 'INDIVIDUAL')
  )
);

create index if not exists session_slots_start_time_idx on public.session_slots (start_time);
create index if not exists session_slots_recurring_group_idx on public.session_slots (recurring_group_id);

-- 5. Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_slot_id uuid not null references public.session_slots(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'CANCELLED')),
  is_admin_override boolean not null default false,
  notes text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (session_slot_id, student_id)
);

create index if not exists bookings_student_idx on public.bookings (student_id);
create index if not exists bookings_slot_idx on public.bookings (session_slot_id);

-- Prevent double-booking beyond capacity via trigger (capacity can be >1 for recurring classes)
create or replace function public.check_slot_capacity()
returns trigger as $$
declare
  active_count integer;
  cap integer;
begin
  if new.status = 'CANCELLED' then
    return new;
  end if;

  select max_capacity into cap from public.session_slots where id = new.session_slot_id;

  select count(*) into active_count
  from public.bookings
  where session_slot_id = new.session_slot_id
    and status <> 'CANCELLED'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if active_count + 1 > cap then
    raise exception 'Slot % is at capacity', new.session_slot_id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_check_slot_capacity on public.bookings;
create trigger trg_check_slot_capacity
  before insert or update on public.bookings
  for each row execute function public.check_slot_capacity();

-- 6. Row Level Security
alter table public.availability_rules enable row level security;
alter table public.recurring_groups enable row level security;
alter table public.session_slots enable row level security;
alter table public.bookings enable row level security;

-- Helper to check admin role for the current auth user
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

-- availability_rules: everyone can read (to compute open slots), only admin can write
drop policy if exists "availability_rules_select" on public.availability_rules;
create policy "availability_rules_select" on public.availability_rules
  for select using (true);

drop policy if exists "availability_rules_admin_write" on public.availability_rules;
create policy "availability_rules_admin_write" on public.availability_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- recurring_groups: everyone can read, only admin can write
drop policy if exists "recurring_groups_select" on public.recurring_groups;
create policy "recurring_groups_select" on public.recurring_groups
  for select using (true);

drop policy if exists "recurring_groups_admin_write" on public.recurring_groups;
create policy "recurring_groups_admin_write" on public.recurring_groups
  for all using (public.is_admin()) with check (public.is_admin());

-- session_slots: everyone can read, only admin can write directly
drop policy if exists "session_slots_select" on public.session_slots;
create policy "session_slots_select" on public.session_slots
  for select using (true);

drop policy if exists "session_slots_admin_write" on public.session_slots;
create policy "session_slots_admin_write" on public.session_slots
  for all using (public.is_admin()) with check (public.is_admin());

-- bookings: students can see/cancel their own; admins can see/manage all
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
create policy "bookings_select_own_or_admin" on public.bookings
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists "bookings_insert_own_or_admin" on public.bookings;
create policy "bookings_insert_own_or_admin" on public.bookings
  for insert with check (student_id = auth.uid() or public.is_admin());

drop policy if exists "bookings_update_own_or_admin" on public.bookings;
create policy "bookings_update_own_or_admin" on public.bookings
  for update using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- profiles: users can read/update their own profile, admin can read/update all
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable realtime for live slot/booking updates
alter publication supabase_realtime add table public.session_slots;
alter publication supabase_realtime add table public.bookings;
