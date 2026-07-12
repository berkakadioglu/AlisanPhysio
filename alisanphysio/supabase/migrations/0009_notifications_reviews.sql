-- =============================================================================
-- AlisanPhysio — notifications + weekly reviews.
-- Run AFTER 0008, in the Supabase SQL editor. Safe/idempotent (re-runnable).
--
-- SECURITY: both tables are strictly per-user for reads. A user sees ONLY their
-- own notifications/reviews (user_id = auth.uid()). Staff may INSERT manual
-- notifications for anyone (is_staff()) and SELECT all reviews (to review them),
-- but there is NO cross-user read of notifications.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- notifications
-- dedupe_key makes system-notification generation idempotent: a stable key per
-- (user, kind, period) with a UNIQUE(user_id, dedupe_key) constraint, so an
-- upsert with ignoreDuplicates never spams. Manual sends get a random default
-- key so they never collide.
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null
    check (type in ('membership_expiry', 'missing_info', 'weekly_review', 'manual')),
  title      text not null,
  body       text,
  link       text,                       -- optional in-app route to open
  read       boolean not null default false,
  dedupe_key text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- weekly_reviews — one per (user, week_start). Client fills it in; staff read it.
-- -----------------------------------------------------------------------------
create table if not exists public.weekly_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  week_start     date not null,                       -- Monday of the reviewed week
  days_attended  integer,
  programs_done  jsonb not null default '[]'::jsonb,  -- [{id,title}]
  hard_exercises jsonb not null default '[]'::jsonb,  -- [{id,name}]
  note           text,
  created_at     timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_reviews_user_idx
  on public.weekly_reviews (user_id, week_start desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.notifications  enable row level security;
alter table public.weekly_reviews enable row level security;

-- --- notifications ----------------------------------------------------------
drop policy if exists "notifications_select_own"   on public.notifications;
drop policy if exists "notifications_insert_own"   on public.notifications;
drop policy if exists "notifications_insert_staff" on public.notifications;
drop policy if exists "notifications_update_own"   on public.notifications;
drop policy if exists "notifications_delete_own"   on public.notifications;

-- A user reads ONLY their own notifications. No staff cross-user read.
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
-- A user creates their own (system notifications generated in their session).
create policy "notifications_insert_own" on public.notifications
  for insert with check (user_id = auth.uid());
-- Staff may create a notification for ANY user (manual sends).
create policy "notifications_insert_staff" on public.notifications
  for insert with check (public.is_staff());
-- A user marks their own read/unread.
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- A user may delete their own.
create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

-- --- weekly_reviews ---------------------------------------------------------
drop policy if exists "weekly_reviews_select_own"   on public.weekly_reviews;
drop policy if exists "weekly_reviews_insert_own"   on public.weekly_reviews;
drop policy if exists "weekly_reviews_update_own"   on public.weekly_reviews;
drop policy if exists "weekly_reviews_delete_own"   on public.weekly_reviews;
drop policy if exists "weekly_reviews_staff_select" on public.weekly_reviews;

-- A user full-CRUDs their OWN reviews.
create policy "weekly_reviews_select_own" on public.weekly_reviews
  for select using (user_id = auth.uid());
create policy "weekly_reviews_insert_own" on public.weekly_reviews
  for insert with check (user_id = auth.uid());
create policy "weekly_reviews_update_own" on public.weekly_reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weekly_reviews_delete_own" on public.weekly_reviews
  for delete using (user_id = auth.uid());
-- Staff read all reviews (Alişan reviews them). Read-only.
create policy "weekly_reviews_staff_select" on public.weekly_reviews
  for select using (public.is_staff());
