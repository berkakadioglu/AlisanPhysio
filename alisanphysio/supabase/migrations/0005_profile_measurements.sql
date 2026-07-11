-- =============================================================================
-- AlisanPhysio — client Profile module: standing height, weekly measurements,
-- and complaints / notes.
-- Run AFTER 0004, in the Supabase SQL editor. Safe/idempotent (re-runnable).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles.height_cm — a client's standing height, used to compute BMI.
-- (Weight is captured per-measurement; height changes rarely, so it lives here.)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists height_cm numeric;  -- nullable

-- -----------------------------------------------------------------------------
-- Let a client UPDATE THEIR OWN profile row (name, height, language).
-- 0001 only granted clients SELECT on their own profile; every write went
-- through the admin. The Profile page needs clients to edit their own name +
-- height, so we add a self-update policy.
--
-- SECURITY: the WITH CHECK pins role = 'client', so a client can never escalate
-- their own row to 'admin'. Admins keep full access via the existing
-- profiles_admin_all policy (permissive policies are OR-combined).
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid() and role = 'client')
  with check (id = auth.uid() and role = 'client');

-- -----------------------------------------------------------------------------
-- measurements: one row per weigh-in / tape-measure session for a client.
-- -----------------------------------------------------------------------------
create table if not exists public.measurements (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,                    -- the date of the measurement
  weight_kg   numeric,                          -- nullable
  waist_cm    numeric,                          -- circumference measures, all nullable
  hip_cm      numeric,
  arm_cm      numeric,
  chest_cm    numeric,
  created_at  timestamptz not null default now()
);

create index if not exists measurements_client_id_idx
  on public.measurements (client_id);
create index if not exists measurements_measured_on_idx
  on public.measurements (measured_on);

-- -----------------------------------------------------------------------------
-- complaints: a timestamped note the client writes to Alişan (pain, how they
-- feel, any issues). Read by the admin from the client detail page.
-- -----------------------------------------------------------------------------
create table if not exists public.complaints (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null,                    -- the complaint / note
  created_at  timestamptz not null default now()  -- timestamp shown to Alişan
);

create index if not exists complaints_client_id_idx
  on public.complaints (client_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Mirrors the existing pattern: a client has full CRUD over ONLY their own
-- rows; an admin has read-only access (they review, never edit) via is_admin().
-- Policy creation is guarded with drop-if-exists so this file is re-runnable.
-- -----------------------------------------------------------------------------
alter table public.measurements enable row level security;
alter table public.complaints   enable row level security;

-- --- measurements -----------------------------------------------------------
drop policy if exists "measurements_select_own" on public.measurements;
create policy "measurements_select_own"
  on public.measurements
  for select
  using (client_id = auth.uid());

drop policy if exists "measurements_insert_own" on public.measurements;
create policy "measurements_insert_own"
  on public.measurements
  for insert
  with check (client_id = auth.uid());

drop policy if exists "measurements_update_own" on public.measurements;
create policy "measurements_update_own"
  on public.measurements
  for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "measurements_delete_own" on public.measurements;
create policy "measurements_delete_own"
  on public.measurements
  for delete
  using (client_id = auth.uid());

-- Admin: read-only (review a client's data; never modify it here).
drop policy if exists "measurements_admin_select" on public.measurements;
create policy "measurements_admin_select"
  on public.measurements
  for select
  using (public.is_admin());

-- --- complaints -------------------------------------------------------------
drop policy if exists "complaints_select_own" on public.complaints;
create policy "complaints_select_own"
  on public.complaints
  for select
  using (client_id = auth.uid());

drop policy if exists "complaints_insert_own" on public.complaints;
create policy "complaints_insert_own"
  on public.complaints
  for insert
  with check (client_id = auth.uid());

drop policy if exists "complaints_update_own" on public.complaints;
create policy "complaints_update_own"
  on public.complaints
  for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "complaints_delete_own" on public.complaints;
create policy "complaints_delete_own"
  on public.complaints
  for delete
  using (client_id = auth.uid());

-- Admin: read-only.
drop policy if exists "complaints_admin_select" on public.complaints;
create policy "complaints_admin_select"
  on public.complaints
  for select
  using (public.is_admin());
