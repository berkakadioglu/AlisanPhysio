-- =============================================================================
-- AlisanPhysio — role ladder admin > manager > client.
-- Reworks RLS around two helpers: is_admin() and is_staff() (admin OR manager).
-- Run AFTER 0007, in the Supabase SQL editor. Safe/idempotent (re-runnable).
--
-- SECURITY MODEL
--   client  : sees ONLY their own rows (programs/measurements/complaints/profile).
--   manager : staff — full CRUD on programs/days/exercises/library, SELECT all
--             profiles + UPDATE client-management fields, read all measurements/
--             complaints. CANNOT change roles or delete users.
--   admin   : everything managers can, PLUS change roles + delete users.
--   Programs are role-independent: programs.client_id = "the user this program
--   is for" (any profile), so staff can author programs for anyone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Allow 'manager' as a role. Existing rows keep their value; default 'client'.
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
    check (role in ('admin', 'manager', 'client'));

-- -----------------------------------------------------------------------------
-- 2. Helpers (SECURITY DEFINER so they read profiles WITHOUT recursing into the
--    profiles RLS policies). is_admin() already exists; (re)assert both.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Guard trigger — privileged columns on profiles.
--    • role         : only an admin may change it (on any row).
--    • membership / membership_end_date : only staff may change them.
--    Clients therefore can't touch their own role/membership; managers can
--    manage client membership but can't grant roles. Service-role (auth.uid()
--    null) bypasses, matching its RLS-bypass by design.
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;  -- service-role: trusted, server-only
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a user''s role.' using errcode = '42501';
  end if;
  if (new.membership is distinct from old.membership
       or new.membership_end_date is distinct from old.membership_end_date)
     and not public.is_staff() then
    raise exception 'Only staff can change membership.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- -----------------------------------------------------------------------------
-- 4. RLS policies — dropped by name then recreated, so re-running this file
--    leaves exactly this set (no stale, over-permissive leftovers).
-- -----------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.programs         enable row level security;
alter table public.program_days     enable row level security;
alter table public.exercises        enable row level security;
alter table public.measurements     enable row level security;
alter table public.complaints       enable row level security;
alter table public.exercise_library enable row level security;

-- --- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_staff"  on public.profiles;
drop policy if exists "profiles_update_own"    on public.profiles;
drop policy if exists "profiles_update_staff"  on public.profiles;
drop policy if exists "profiles_admin_all"     on public.profiles;

-- Any user reads their own row.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
-- Staff read every profile (user list + detail pages).
create policy "profiles_select_staff" on public.profiles
  for select using (public.is_staff());
-- Any user updates their OWN row (self-service: name/height/language). The guard
-- trigger blocks role/membership changes on self for non-admin/non-staff.
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- Staff update any profile (client management). Trigger still restricts role
-- (admin-only) and membership (staff-only) at the column level.
create policy "profiles_update_staff" on public.profiles
  for update using (public.is_staff()) with check (public.is_staff());
-- Admins have unrestricted access, including INSERT/DELETE of profile rows.
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- --- programs ---------------------------------------------------------------
drop policy if exists "programs_select_own" on public.programs;
drop policy if exists "programs_admin_all"  on public.programs;
drop policy if exists "programs_staff_all"  on public.programs;

-- A user reads programs assigned to them (any role — programs-for-anyone).
create policy "programs_select_own" on public.programs
  for select using (client_id = auth.uid());
-- Staff author/read/edit/delete programs for anyone.
create policy "programs_staff_all" on public.programs
  for all using (public.is_staff()) with check (public.is_staff());

-- --- program_days -----------------------------------------------------------
drop policy if exists "program_days_select_own" on public.program_days;
drop policy if exists "program_days_admin_all"  on public.program_days;
drop policy if exists "program_days_staff_all"  on public.program_days;

create policy "program_days_select_own" on public.program_days
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id and p.client_id = auth.uid()
    )
  );
create policy "program_days_staff_all" on public.program_days
  for all using (public.is_staff()) with check (public.is_staff());

-- --- exercises --------------------------------------------------------------
drop policy if exists "exercises_select_own" on public.exercises;
drop policy if exists "exercises_admin_all"  on public.exercises;
drop policy if exists "exercises_staff_all"  on public.exercises;

create policy "exercises_select_own" on public.exercises
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id and p.client_id = auth.uid()
    )
  );
create policy "exercises_staff_all" on public.exercises
  for all using (public.is_staff()) with check (public.is_staff());

-- --- measurements -----------------------------------------------------------
drop policy if exists "measurements_select_own"    on public.measurements;
drop policy if exists "measurements_insert_own"    on public.measurements;
drop policy if exists "measurements_update_own"    on public.measurements;
drop policy if exists "measurements_delete_own"    on public.measurements;
drop policy if exists "measurements_admin_select"  on public.measurements;
drop policy if exists "measurements_staff_select"  on public.measurements;

create policy "measurements_select_own" on public.measurements
  for select using (client_id = auth.uid());
create policy "measurements_insert_own" on public.measurements
  for insert with check (client_id = auth.uid());
create policy "measurements_update_own" on public.measurements
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "measurements_delete_own" on public.measurements
  for delete using (client_id = auth.uid());
-- Staff read-only (review a user's data; never edit it here).
create policy "measurements_staff_select" on public.measurements
  for select using (public.is_staff());

-- --- complaints -------------------------------------------------------------
drop policy if exists "complaints_select_own"    on public.complaints;
drop policy if exists "complaints_insert_own"    on public.complaints;
drop policy if exists "complaints_update_own"    on public.complaints;
drop policy if exists "complaints_delete_own"    on public.complaints;
drop policy if exists "complaints_admin_select"  on public.complaints;
drop policy if exists "complaints_staff_select"  on public.complaints;

create policy "complaints_select_own" on public.complaints
  for select using (client_id = auth.uid());
create policy "complaints_insert_own" on public.complaints
  for insert with check (client_id = auth.uid());
create policy "complaints_update_own" on public.complaints
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "complaints_delete_own" on public.complaints
  for delete using (client_id = auth.uid());
create policy "complaints_staff_select" on public.complaints
  for select using (public.is_staff());

-- --- exercise_library -------------------------------------------------------
drop policy if exists "exercise_library_select_authenticated" on public.exercise_library;
drop policy if exists "exercise_library_admin_all"            on public.exercise_library;
drop policy if exists "exercise_library_staff_all"            on public.exercise_library;

-- Any signed-in user reads the library (to resolve exercise videos/names).
create policy "exercise_library_select_authenticated" on public.exercise_library
  for select using (auth.uid() is not null);
-- Staff manage the library.
create policy "exercise_library_staff_all" on public.exercise_library
  for all using (public.is_staff()) with check (public.is_staff());
