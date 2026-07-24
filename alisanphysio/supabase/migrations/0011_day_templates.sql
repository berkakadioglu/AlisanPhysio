-- =============================================================================
-- AlisanPhysio — reusable day templates
-- Run AFTER 0010, in the Supabase SQL editor. Safe/idempotent (re-runnable).
--
-- A day template is a reusable "day blueprint" (e.g. "Push Day") that Alişan
-- builds once and drops into any client's program with one click. Templates are
-- STAFF-ONLY tooling — global/shared across staff, like the exercise library.
-- Clients never see templates directly (a program gets a DEEP COPY of the
-- template's exercises when one is added), so there is NO client access here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- day_templates — the blueprint (just a title; exercises live in the child).
-- -----------------------------------------------------------------------------
create table if not exists public.day_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,                       -- e.g. "Push Day"
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- day_template_exercises — the exercises inside a template, with a default
-- prescription. library_id links to the shared library (for its video/name);
-- one-off exercises leave it null. Deleting a template cascades its rows;
-- deleting a library entry just nulls the link (the template keeps the name).
-- -----------------------------------------------------------------------------
create table if not exists public.day_template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.day_templates (id)   on delete cascade,
  name         text not null,
  library_id   uuid          references public.exercise_library (id) on delete set null,
  sets         integer,
  reps         text,
  instructions text,
  media_url    text,
  order_index  integer not null default 0
);

create index if not exists day_template_exercises_template_idx
  on public.day_template_exercises (template_id, order_index);

-- -----------------------------------------------------------------------------
-- Row Level Security — staff-only (is_staff()) full CRUD on both tables.
-- No authenticated/client SELECT: templates are internal staff tooling.
-- -----------------------------------------------------------------------------
alter table public.day_templates          enable row level security;
alter table public.day_template_exercises enable row level security;

drop policy if exists "day_templates_staff_all" on public.day_templates;
create policy "day_templates_staff_all" on public.day_templates
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "day_template_exercises_staff_all" on public.day_template_exercises;
create policy "day_template_exercises_staff_all" on public.day_template_exercises
  for all using (public.is_staff()) with check (public.is_staff());
