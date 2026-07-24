-- =============================================================================
-- AlisanPhysio — availability requests ("meeting requests").
-- Run AFTER 0012, in the Supabase SQL editor. Safe/idempotent (re-runnable).
--
-- PURPOSE
--   Alişan asks clients when they're free (roughly every two weeks) so he can
--   arrange sessions himself, OUTSIDE the app. This is availability COLLECTION
--   only — no booking, confirmations, calendar or conflict checking.
--
-- STRUCTURE
--   availability_requests : one per (client, week). Staff create these; a client
--     reads only their own. Unique(client_id, week_start) so nobody is asked
--     twice for the same week.
--   availability_slots    : the client's answers — 0..N per request, each a day
--     within that week with a free-form time range + optional note.
--
-- SECURITY (mirrors notifications / weekly_reviews / nutrition)
--   requests : a client SELECTs their OWN (client_id = auth.uid()); staff
--     (is_staff()) full CRUD. NO cross-user client read.
--   slots    : a client full-CRUDs their OWN (via the parent request's
--     client_id = auth.uid()); staff full CRUD. NO cross-user client read.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- availability_requests — staff asks one client about one week.
-- created_by is nulled (not cascaded) if the staff account is ever removed, so
-- the request + the client's answers survive.
-- -----------------------------------------------------------------------------
create table if not exists public.availability_requests (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,                       -- Monday of the asked-about week
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
);

create index if not exists availability_requests_client_idx
  on public.availability_requests (client_id, week_start desc);
create index if not exists availability_requests_week_idx
  on public.availability_requests (week_start);

-- -----------------------------------------------------------------------------
-- availability_slots — a client's chosen day + free-form time range for a
-- request. Times are stored as plain text (e.g. "18:00"–"20:00") so the range
-- stays simple and readable; either end may be null.
-- -----------------------------------------------------------------------------
create table if not exists public.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.availability_requests (id) on delete cascade,
  day_date   date not null,                       -- a specific day within the week
  time_from  text,
  time_to    text,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists availability_slots_request_idx
  on public.availability_slots (request_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.availability_requests enable row level security;
alter table public.availability_slots    enable row level security;

-- --- availability_requests --------------------------------------------------
drop policy if exists "availability_requests_select_own" on public.availability_requests;
drop policy if exists "availability_requests_staff_all"  on public.availability_requests;

-- A client reads ONLY the requests addressed to them.
create policy "availability_requests_select_own" on public.availability_requests
  for select using (client_id = auth.uid());
-- Staff create/read/edit/delete requests for anyone.
create policy "availability_requests_staff_all" on public.availability_requests
  for all using (public.is_staff()) with check (public.is_staff());

-- --- availability_slots -----------------------------------------------------
drop policy if exists "availability_slots_select_own" on public.availability_slots;
drop policy if exists "availability_slots_insert_own" on public.availability_slots;
drop policy if exists "availability_slots_update_own" on public.availability_slots;
drop policy if exists "availability_slots_delete_own" on public.availability_slots;
drop policy if exists "availability_slots_staff_all"  on public.availability_slots;

-- A client full-CRUDs the slots under their OWN request (checked via the parent).
create policy "availability_slots_select_own" on public.availability_slots
  for select using (
    exists (
      select 1 from public.availability_requests r
      where r.id = availability_slots.request_id and r.client_id = auth.uid()
    )
  );
create policy "availability_slots_insert_own" on public.availability_slots
  for insert with check (
    exists (
      select 1 from public.availability_requests r
      where r.id = availability_slots.request_id and r.client_id = auth.uid()
    )
  );
create policy "availability_slots_update_own" on public.availability_slots
  for update using (
    exists (
      select 1 from public.availability_requests r
      where r.id = availability_slots.request_id and r.client_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.availability_requests r
      where r.id = availability_slots.request_id and r.client_id = auth.uid()
    )
  );
create policy "availability_slots_delete_own" on public.availability_slots
  for delete using (
    exists (
      select 1 from public.availability_requests r
      where r.id = availability_slots.request_id and r.client_id = auth.uid()
    )
  );
-- Staff manage every client's slots (to read submissions; edits allowed).
create policy "availability_slots_staff_all" on public.availability_slots
  for all using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- Extend the notifications type check to allow the new 'availability' kind, so
-- an availability request surfaces in the client's notification bell. Drop +
-- re-add keeps this re-runnable.
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('membership_expiry', 'missing_info', 'weekly_review', 'manual', 'availability'));
