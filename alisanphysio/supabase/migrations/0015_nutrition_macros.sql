-- =============================================================================
-- AlisanPhysio — nutrition values and bilingual food-library names.
--
-- Schema only. This migration deliberately does not alter RLS or seed data.
-- Safe/idempotent: every column uses ADD COLUMN IF NOT EXISTS.
-- =============================================================================

alter table public.food_library
  add column if not exists name_tr text,
  add column if not exists kcal numeric,
  add column if not exists protein_g numeric,
  add column if not exists carb_g numeric,
  add column if not exists fat_g numeric;

alter table public.meal_items
  add column if not exists kcal numeric,
  add column if not exists protein_g numeric,
  add column if not exists carb_g numeric,
  add column if not exists fat_g numeric;

alter table public.nutrition_plans
  add column if not exists daily_kcal_target numeric;

comment on column public.food_library.name_tr is
  'Optional Turkish display name; name remains the canonical English name.';
comment on column public.food_library.kcal is
  'Kilocalories in the default portion; null when not tracked.';
comment on column public.food_library.protein_g is
  'Protein grams in the default portion; null when not tracked.';
comment on column public.food_library.carb_g is
  'Carbohydrate grams in the default portion; null when not tracked.';
comment on column public.food_library.fat_g is
  'Fat grams in the default portion; null when not tracked.';
comment on column public.meal_items.kcal is
  'Kilocalorie snapshot for this item portion; null when not tracked.';
comment on column public.meal_items.protein_g is
  'Protein-gram snapshot for this item portion; null when not tracked.';
comment on column public.meal_items.carb_g is
  'Carbohydrate-gram snapshot for this item portion; null when not tracked.';
comment on column public.meal_items.fat_g is
  'Fat-gram snapshot for this item portion; null when not tracked.';
comment on column public.nutrition_plans.daily_kcal_target is
  'Optional daily kilocalorie target authored by staff.';
