-- =============================================================================
-- AlisanPhysio — nutrition module (v1, no macros/calories).
-- Run AFTER 0011, in the Supabase SQL editor. Safe/idempotent (re-runnable).
--
-- STRUCTURE
--   food_library     : shared reference foods (like exercise_library, simpler).
--   nutrition_plans  : ONE current plan per user (client_id UNIQUE).
--   meals            : Breakfast/Lunch/Dinner/Snack (or custom) inside a plan.
--   meal_items       : a food (name + portion + note) inside a meal.
--
-- SECURITY (mirrors programs/program_days/exercises)
--   food_library : any signed-in user SELECTs; only staff (is_staff()) write.
--   plan/meals/items : a user reads ONLY their OWN (via plan.client_id =
--     auth.uid()); staff have full CRUD. There is NO cross-user client read.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- food_library — shared, staff-curated foods with a sensible default portion.
-- -----------------------------------------------------------------------------
create table if not exists public.food_library (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  default_portion text,                                -- e.g. "1 cup", "150g"
  note            text,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- nutrition_plans — one current plan per user (UNIQUE client_id). A plan is a
-- container: general notes + its meals. Deleting the user cascades the plan.
-- -----------------------------------------------------------------------------
create table if not exists public.nutrition_plans (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null unique references public.profiles (id) on delete cascade,
  notes      text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- meals — an ordered section of a plan (Breakfast/Lunch/Dinner/Snack/custom).
-- -----------------------------------------------------------------------------
create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.nutrition_plans (id) on delete cascade,
  title       text not null,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists meals_plan_idx
  on public.meals (plan_id, order_index);

-- -----------------------------------------------------------------------------
-- meal_items — a food row inside a meal. library_id links a food_library entry
-- (nulled if that entry is later deleted); one-off items leave it null.
-- -----------------------------------------------------------------------------
create table if not exists public.meal_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals (id) on delete cascade,
  name        text not null,
  library_id  uuid references public.food_library (id) on delete set null,
  portion     text,
  note        text,
  order_index integer not null default 0
);

create index if not exists meal_items_meal_idx
  on public.meal_items (meal_id, order_index);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.food_library    enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meals           enable row level security;
alter table public.meal_items      enable row level security;

-- --- food_library -----------------------------------------------------------
drop policy if exists "food_library_select_authenticated" on public.food_library;
drop policy if exists "food_library_staff_all"            on public.food_library;

-- Any signed-in user reads the food library (to resolve item names/portions).
create policy "food_library_select_authenticated" on public.food_library
  for select using (auth.uid() is not null);
-- Staff manage the food library.
create policy "food_library_staff_all" on public.food_library
  for all using (public.is_staff()) with check (public.is_staff());

-- --- nutrition_plans --------------------------------------------------------
drop policy if exists "nutrition_plans_select_own" on public.nutrition_plans;
drop policy if exists "nutrition_plans_staff_all"  on public.nutrition_plans;

-- A user reads the plan assigned to them.
create policy "nutrition_plans_select_own" on public.nutrition_plans
  for select using (client_id = auth.uid());
-- Staff author/read/edit/delete plans for anyone.
create policy "nutrition_plans_staff_all" on public.nutrition_plans
  for all using (public.is_staff()) with check (public.is_staff());

-- --- meals ------------------------------------------------------------------
drop policy if exists "meals_select_own" on public.meals;
drop policy if exists "meals_staff_all"  on public.meals;

create policy "meals_select_own" on public.meals
  for select using (
    exists (
      select 1 from public.nutrition_plans p
      where p.id = meals.plan_id and p.client_id = auth.uid()
    )
  );
create policy "meals_staff_all" on public.meals
  for all using (public.is_staff()) with check (public.is_staff());

-- --- meal_items -------------------------------------------------------------
drop policy if exists "meal_items_select_own" on public.meal_items;
drop policy if exists "meal_items_staff_all"  on public.meal_items;

create policy "meal_items_select_own" on public.meal_items
  for select using (
    exists (
      select 1
      from public.meals m
      join public.nutrition_plans p on p.id = m.plan_id
      where m.id = meal_items.meal_id and p.client_id = auth.uid()
    )
  );
create policy "meal_items_staff_all" on public.meal_items
  for all using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- Seed common foods (idempotent — re-runnable without duplicating). Names are
-- stored in English; the food combobox/list show them as typed (single language,
-- like custom exercise categories).
-- -----------------------------------------------------------------------------
insert into public.food_library (name, default_portion)
select v.name, v.portion
from (values
  ('Oats',              '1 cup cooked'),
  ('Eggs',              '2 eggs'),
  ('Chicken breast',    '150 g'),
  ('Rice',              '1 cup cooked'),
  ('Greek yogurt',      '200 g'),
  ('Banana',            '1 medium'),
  ('Almonds',           '30 g'),
  ('Salmon',            '150 g'),
  ('Broccoli',          '1 cup'),
  ('Whole-grain bread', '2 slices'),
  ('Olive oil',         '1 tbsp'),
  ('Cottage cheese',    '150 g')
) as v(name, portion)
where not exists (
  select 1 from public.food_library f where f.name = v.name
);
