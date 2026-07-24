-- =============================================================================
-- AlisanPhysio — exercise categories (+ many-to-many mapping)
-- Run AFTER 0009, in the Supabase SQL editor. Safe/idempotent (re-runnable).
--
-- Categories are shared reference data (like exercise_library): any signed-in
-- user may SELECT them (needed to display/filter), but only staff (is_staff())
-- may write. Default categories are seeded with is_default=true and can't be
-- deleted from the UI (guarded there); custom ones Alişan adds are shown as
-- typed (single language). Deleting a category cascades its mappings but never
-- touches the exercises themselves.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- exercise_categories
-- -----------------------------------------------------------------------------
create table if not exists public.exercise_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- exercise_category_map — an exercise can belong to several categories
-- (e.g. Deadlift = Back + Legs). Both sides cascade on delete: removing an
-- exercise or a category drops the mapping row, but deleting a category leaves
-- the exercises intact.
-- -----------------------------------------------------------------------------
create table if not exists public.exercise_category_map (
  exercise_id uuid not null references public.exercise_library (id)    on delete cascade,
  category_id uuid not null references public.exercise_categories (id) on delete cascade,
  primary key (exercise_id, category_id)
);

-- Reverse lookup (all exercises in a category); the PK already covers
-- (exercise_id, ...) for the forward direction.
create index if not exists exercise_category_map_category_idx
  on public.exercise_category_map (category_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.exercise_categories  enable row level security;
alter table public.exercise_category_map enable row level security;

-- --- exercise_categories ----------------------------------------------------
drop policy if exists "exercise_categories_select_authenticated" on public.exercise_categories;
drop policy if exists "exercise_categories_staff_all"            on public.exercise_categories;

-- Shared reference data: any signed-in user may read.
create policy "exercise_categories_select_authenticated" on public.exercise_categories
  for select using (auth.uid() is not null);
-- Only staff may create / rename / delete.
create policy "exercise_categories_staff_all" on public.exercise_categories
  for all using (public.is_staff()) with check (public.is_staff());

-- --- exercise_category_map --------------------------------------------------
drop policy if exists "exercise_category_map_select_authenticated" on public.exercise_category_map;
drop policy if exists "exercise_category_map_staff_all"            on public.exercise_category_map;

create policy "exercise_category_map_select_authenticated" on public.exercise_category_map
  for select using (auth.uid() is not null);
create policy "exercise_category_map_staff_all" on public.exercise_category_map
  for all using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- Seed the default categories (idempotent — re-runnable without duplicating).
-- English names are stored; the UI translates the default set for display
-- (see DEFAULT_CATEGORY_NAMES in src/lib/i18n.ts). Custom categories added
-- later are shown exactly as typed.
-- -----------------------------------------------------------------------------
insert into public.exercise_categories (name, is_default)
select v.name, true
from (values
  ('Chest'), ('Back'), ('Legs'), ('Shoulders'), ('Arms'),
  ('Core'), ('Full Body'), ('Mobility'), ('Rehab')
) as v(name)
where not exists (
  select 1 from public.exercise_categories c
  where c.name = v.name and c.is_default = true
);
