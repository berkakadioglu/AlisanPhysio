-- =============================================================================
-- AlisanPhysio — initial schema, Row Level Security, and helpers
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- profiles: one row per auth user, holding role + display name.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now()
);

-- programs: a weekly program written by the admin for a specific client.
create table if not exists public.programs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles (id) on delete cascade,
  title           text not null,                 -- e.g. "Week of Aug 4, 2026"
  week_start_date date not null,                 -- the Monday of that week
  notes           text,                          -- general notes for the week
  created_at      timestamptz not null default now()
);

create index if not exists programs_client_id_idx
  on public.programs (client_id);
create index if not exists programs_week_start_date_idx
  on public.programs (week_start_date);

-- exercises: the ordered items that make up a program.
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs (id) on delete cascade,
  name         text not null,
  sets         integer,        -- nullable
  reps         text,           -- text: e.g. "10-12" or "30 sec hold"
  instructions text,           -- nullable
  media_url    text,           -- nullable: demo video / image link
  order_index  integer not null default 0  -- display order within a program
);

create index if not exists exercises_program_id_idx
  on public.exercises (program_id);


-- -----------------------------------------------------------------------------
-- Helper: is_admin()
-- SECURITY DEFINER so it can read profiles WITHOUT triggering the RLS policies
-- on profiles (which would otherwise recurse infinitely).
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;


-- -----------------------------------------------------------------------------
-- Auto-create a profile whenever a new auth user is created.
-- The admin creates client accounts (no public sign-up); this trigger makes
-- sure every user has a matching profile row (defaulting to role 'client').
-- Promote Alişan to admin manually after his account exists:
--   update public.profiles set role = 'admin' where id = '<his-user-id>';
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.programs  enable row level security;
alter table public.exercises enable row level security;

-- --- profiles ---------------------------------------------------------------
-- A client can read only their own profile.
create policy "profiles_select_own"
  on public.profiles
  for select
  using (id = auth.uid());

-- An admin can read/insert/update/delete every profile.
create policy "profiles_admin_all"
  on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- programs ---------------------------------------------------------------
-- A client can read only programs that belong to them.
create policy "programs_select_own"
  on public.programs
  for select
  using (client_id = auth.uid());

-- An admin can do everything with programs.
create policy "programs_admin_all"
  on public.programs
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- exercises --------------------------------------------------------------
-- A client can read only exercises that belong to one of their own programs.
create policy "exercises_select_own"
  on public.exercises
  for select
  using (
    exists (
      select 1
      from public.programs p
      where p.id = exercises.program_id
        and p.client_id = auth.uid()
    )
  );

-- An admin can do everything with exercises.
create policy "exercises_admin_all"
  on public.exercises
  for all
  using (public.is_admin())
  with check (public.is_admin());
