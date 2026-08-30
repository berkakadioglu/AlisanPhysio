-- =============================================================================
-- AlisanPhysio — public assessment requests.
-- Run AFTER 0013 in the Supabase SQL Editor. Safe/idempotent (re-runnable).
--
-- Public visitors never access this table directly. The public form inserts
-- through the server-only service-role client. Only authenticated admins may
-- read or update requests through the normal session client + RLS.
-- =============================================================================

create table if not exists public.assessment_requests (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  full_name           text not null,
  email               text not null,
  phone               text,
  country             text,
  city                text,
  preferred_language  text not null,

  birth_year          int,
  sex                 text,
  height_cm           numeric,
  weight_kg           numeric,

  primary_goal        text not null,
  training_experience text,
  days_per_week       int,
  equipment_access    text,

  injury_history      text,
  medical_notes       text,

  selected_plan       text,
  message             text,

  status              text not null default 'new',
  admin_note          text,
  reviewed_at         timestamptz,

  constraint assessment_requests_language_check
    check (preferred_language in ('en', 'tr')),
  constraint assessment_requests_status_check
    check (status in ('new', 'contacted', 'accepted', 'declined'))
);

create index if not exists assessment_requests_status_created_idx
  on public.assessment_requests (status, created_at desc);

alter table public.assessment_requests enable row level security;

drop policy if exists "assessment_requests_admin_select"
  on public.assessment_requests;
drop policy if exists "assessment_requests_admin_update"
  on public.assessment_requests;

create policy "assessment_requests_admin_select"
  on public.assessment_requests
  for select
  to authenticated
  using (public.is_admin());

create policy "assessment_requests_admin_update"
  on public.assessment_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
