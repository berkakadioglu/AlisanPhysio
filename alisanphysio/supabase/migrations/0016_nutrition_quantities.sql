-- =============================================================================
-- AlisanPhysio — structured nutrition quantities and proportional servings.
--
-- Run manually AFTER 0015_nutrition_macros.sql. Do not run automatically.
-- Safe/idempotent: columns and constraints can be applied more than once, and
-- the conservative backfill only touches rows whose new quantity/unit pair is
-- still entirely null. Existing free-text portions remain as a display fallback.
--
-- This migration deliberately makes no RLS or policy changes.
-- =============================================================================

alter table public.food_library
  add column if not exists serving_qty numeric,
  add column if not exists serving_unit text,
  add column if not exists grams_per_unit numeric;

alter table public.meal_items
  add column if not exists quantity numeric,
  add column if not exists unit text,
  add column if not exists is_manual_override boolean;

-- A partially applied earlier run may have created the boolean without its
-- required default/constraint. Repair that state without changing true values.
alter table public.meal_items
  alter column is_manual_override set default false;

update public.meal_items
set is_manual_override = false
where is_manual_override is null;

alter table public.meal_items
  alter column is_manual_override set not null;

alter table public.nutrition_plans
  add column if not exists daily_protein_target_g numeric;

comment on column public.food_library.serving_qty is
  'Numeric amount described by serving_unit for which the stored nutrition values apply.';
comment on column public.food_library.serving_unit is
  'Structured serving unit: g, ml, piece, scoop, tbsp, tsp, or cup.';
comment on column public.food_library.grams_per_unit is
  'Optional exact gram equivalent for one non-g/ml serving unit, derived only from a parenthetical gram amount.';
comment on column public.meal_items.quantity is
  'Numeric item quantity; null means the legacy free-text portion remains the display fallback.';
comment on column public.meal_items.unit is
  'Structured item unit: g, ml, piece, scoop, tbsp, tsp, or cup.';
comment on column public.meal_items.is_manual_override is
  'True when stored item nutrition values must not be recalculated from the linked food-library serving.';
comment on column public.nutrition_plans.daily_protein_target_g is
  'Optional daily protein target in grams authored by staff.';

-- -----------------------------------------------------------------------------
-- Conservative legacy backfill.
--
-- Recognised numbers include decimals (1.5 / 1,5) and simple fractions (1/2).
-- Recognised units are deliberately narrow. Count words such as medium, bar,
-- caplet, slice, and egg map to piece. Unrecognised text remains null.
--
-- food_library keeps a recognised non-mass serving unit when an exact
-- parenthetical gram amount exists and records the exact mass per ONE unit:
--   2 large (100 g)       -> 2 piece, grams_per_unit 50
--   1/2 medium (100 g)    -> 0.5 piece, grams_per_unit 200
--   2 scoops (336 g)      -> 2 scoop, grams_per_unit 168
-- A parenthetical ml amount is not mass and therefore wins as the exact ml
-- serving instead (1 cup (245 ml) -> 245 ml, grams_per_unit null).
--
-- meal_items instead prefers the exact parenthetical amount:
--   1 cup cooked (234 g)  -> 234 g
-- -----------------------------------------------------------------------------
do $migration$
declare
  source_row record;
  parenthetical_match text[];
  leading_match text[];
  parenthetical_qty numeric;
  parenthetical_unit text;
  leading_qty numeric;
  leading_token text;
  leading_unit text;
  parsed_qty numeric;
  parsed_unit text;
  parsed_grams_per_unit numeric;
begin
  for source_row in
    select id, default_portion
    from public.food_library
    where default_portion is not null
      and serving_qty is null
      and serving_unit is null
  loop
    parenthetical_match := regexp_match(
      lower(source_row.default_portion),
      '\([[:space:]]*([0-9]+[[:space:]]*/[[:space:]]*[0-9]+|[0-9]+(?:[.,][0-9]+)?)[[:space:]]*(g|gr|grams?|grammes?|ml|milliliters?|millilitres?)(?:[[:space:]][^)]*)?\)',
      'i'
    );
    leading_match := regexp_match(
      lower(source_row.default_portion),
      '^[[:space:]]*([0-9]+[[:space:]]*/[[:space:]]*[0-9]+|[0-9]+(?:[.,][0-9]+)?)[[:space:]]*(g|gr|grams?|grammes?|ml|milliliters?|millilitres?|pieces?|scoops?|tbsp|tablespoons?|tsp|teaspoons?|cups?|medium|large|small|bars?|caplets?|softgels?|tablets?|eggs?|slices?|cakes?)(?:[[:space:]]|$|\()',
      'i'
    );

    parenthetical_qty := null;
    parenthetical_unit := null;
    leading_qty := null;
    leading_token := null;
    leading_unit := null;
    parsed_qty := null;
    parsed_unit := null;
    parsed_grams_per_unit := null;

    if parenthetical_match is not null then
      if position('/' in parenthetical_match[1]) > 0 then
        parenthetical_qty :=
          trim(split_part(parenthetical_match[1], '/', 1))::numeric
          / nullif(trim(split_part(parenthetical_match[1], '/', 2))::numeric, 0);
      else
        parenthetical_qty := replace(parenthetical_match[1], ',', '.')::numeric;
      end if;

      if lower(parenthetical_match[2]) in ('g', 'gr', 'gram', 'grams', 'gramme', 'grammes') then
        parenthetical_unit := 'g';
      else
        parenthetical_unit := 'ml';
      end if;
    end if;

    if leading_match is not null then
      if position('/' in leading_match[1]) > 0 then
        leading_qty :=
          trim(split_part(leading_match[1], '/', 1))::numeric
          / nullif(trim(split_part(leading_match[1], '/', 2))::numeric, 0);
      else
        leading_qty := replace(leading_match[1], ',', '.')::numeric;
      end if;

      leading_token := lower(leading_match[2]);
      leading_unit := case
        when leading_token in ('g', 'gr', 'gram', 'grams', 'gramme', 'grammes') then 'g'
        when leading_token in ('ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres') then 'ml'
        when leading_token in ('scoop', 'scoops') then 'scoop'
        when leading_token in ('tbsp', 'tablespoon', 'tablespoons') then 'tbsp'
        when leading_token in ('tsp', 'teaspoon', 'teaspoons') then 'tsp'
        when leading_token in ('cup', 'cups') then 'cup'
        when leading_token in (
          'piece', 'pieces', 'medium', 'large', 'small', 'bar', 'bars',
          'caplet', 'caplets', 'softgel', 'softgels', 'tablet', 'tablets',
          'egg', 'eggs', 'slice', 'slices', 'cake', 'cakes'
        ) then 'piece'
        else null
      end;
    end if;

    if leading_qty > 0
       and leading_unit in ('piece', 'scoop', 'tbsp', 'tsp', 'cup')
       and parenthetical_qty > 0
       and parenthetical_unit = 'g' then
      parsed_qty := leading_qty;
      parsed_unit := leading_unit;
      parsed_grams_per_unit := parenthetical_qty / leading_qty;
    elsif parenthetical_qty > 0 and parenthetical_unit in ('g', 'ml') then
      parsed_qty := parenthetical_qty;
      parsed_unit := parenthetical_unit;
    elsif leading_qty > 0 and leading_unit is not null then
      parsed_qty := leading_qty;
      parsed_unit := leading_unit;
    end if;

    if parsed_qty is not null and parsed_unit is not null then
      update public.food_library
      set serving_qty = parsed_qty,
          serving_unit = parsed_unit,
          grams_per_unit = coalesce(grams_per_unit, parsed_grams_per_unit)
      where id = source_row.id
        and serving_qty is null
        and serving_unit is null;
    end if;
  end loop;

  for source_row in
    select id, portion
    from public.meal_items
    where portion is not null
      and quantity is null
      and unit is null
  loop
    parenthetical_match := regexp_match(
      lower(source_row.portion),
      '\([[:space:]]*([0-9]+[[:space:]]*/[[:space:]]*[0-9]+|[0-9]+(?:[.,][0-9]+)?)[[:space:]]*(g|gr|grams?|grammes?|ml|milliliters?|millilitres?)(?:[[:space:]][^)]*)?\)',
      'i'
    );
    leading_match := regexp_match(
      lower(source_row.portion),
      '^[[:space:]]*([0-9]+[[:space:]]*/[[:space:]]*[0-9]+|[0-9]+(?:[.,][0-9]+)?)[[:space:]]*(g|gr|grams?|grammes?|ml|milliliters?|millilitres?|pieces?|scoops?|tbsp|tablespoons?|tsp|teaspoons?|cups?|medium|large|small|bars?|caplets?|softgels?|tablets?|eggs?|slices?|cakes?)(?:[[:space:]]|$|\()',
      'i'
    );

    parenthetical_qty := null;
    parenthetical_unit := null;
    leading_qty := null;
    leading_token := null;
    leading_unit := null;
    parsed_qty := null;
    parsed_unit := null;

    if parenthetical_match is not null then
      if position('/' in parenthetical_match[1]) > 0 then
        parenthetical_qty :=
          trim(split_part(parenthetical_match[1], '/', 1))::numeric
          / nullif(trim(split_part(parenthetical_match[1], '/', 2))::numeric, 0);
      else
        parenthetical_qty := replace(parenthetical_match[1], ',', '.')::numeric;
      end if;

      if lower(parenthetical_match[2]) in ('g', 'gr', 'gram', 'grams', 'gramme', 'grammes') then
        parenthetical_unit := 'g';
      else
        parenthetical_unit := 'ml';
      end if;
    end if;

    if leading_match is not null then
      if position('/' in leading_match[1]) > 0 then
        leading_qty :=
          trim(split_part(leading_match[1], '/', 1))::numeric
          / nullif(trim(split_part(leading_match[1], '/', 2))::numeric, 0);
      else
        leading_qty := replace(leading_match[1], ',', '.')::numeric;
      end if;

      leading_token := lower(leading_match[2]);
      leading_unit := case
        when leading_token in ('g', 'gr', 'gram', 'grams', 'gramme', 'grammes') then 'g'
        when leading_token in ('ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres') then 'ml'
        when leading_token in ('scoop', 'scoops') then 'scoop'
        when leading_token in ('tbsp', 'tablespoon', 'tablespoons') then 'tbsp'
        when leading_token in ('tsp', 'teaspoon', 'teaspoons') then 'tsp'
        when leading_token in ('cup', 'cups') then 'cup'
        when leading_token in (
          'piece', 'pieces', 'medium', 'large', 'small', 'bar', 'bars',
          'caplet', 'caplets', 'softgel', 'softgels', 'tablet', 'tablets',
          'egg', 'eggs', 'slice', 'slices', 'cake', 'cakes'
        ) then 'piece'
        else null
      end;
    end if;

    if parenthetical_qty > 0 and parenthetical_unit in ('g', 'ml') then
      parsed_qty := parenthetical_qty;
      parsed_unit := parenthetical_unit;
    elsif leading_qty > 0 and leading_unit is not null then
      parsed_qty := leading_qty;
      parsed_unit := leading_unit;
    end if;

    if parsed_qty is not null and parsed_unit is not null then
      update public.meal_items
      set quantity = parsed_qty,
          unit = parsed_unit
      where id = source_row.id
        and quantity is null
        and unit is null;
    end if;
  end loop;
end
$migration$;

-- Add nullable unit checks without relying on ADD CONSTRAINT IF NOT EXISTS,
-- which PostgreSQL does not support. CHECK naturally permits null values.
do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_library_serving_unit_check'
      and conrelid = 'public.food_library'::regclass
  ) then
    alter table public.food_library
      add constraint food_library_serving_unit_check
      check (serving_unit in ('g', 'ml', 'piece', 'scoop', 'tbsp', 'tsp', 'cup'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'meal_items_unit_check'
      and conrelid = 'public.meal_items'::regclass
  ) then
    alter table public.meal_items
      add constraint meal_items_unit_check
      check (unit in ('g', 'ml', 'piece', 'scoop', 'tbsp', 'tsp', 'cup'))
      not valid;
  end if;

  alter table public.food_library
    validate constraint food_library_serving_unit_check;
  alter table public.meal_items
    validate constraint meal_items_unit_check;
end
$constraints$;

-- =============================================================================
-- BACKFILL AUDIT / REPORT — safe to rerun independently after the migration.
--
-- Returns one summary row for each table (including 0/0 for an empty table),
-- followed by every row that remains unconverted with its ID, name, legacy
-- free-text value, and which structured fields are still null.
-- =============================================================================
with audit_rows as (
  select
    'food_library'::text as source_table,
    id,
    name as row_name,
    default_portion as legacy_value,
    serving_qty as quantity,
    serving_unit as unit,
    grams_per_unit,
    case
      when serving_qty is not null and serving_unit is not null then 'converted'
      else 'unconverted'
    end as conversion_status,
    concat_ws(
      ', ',
      case when serving_qty is null then 'serving_qty' end,
      case when serving_unit is null then 'serving_unit' end
    ) as missing_fields
  from public.food_library

  union all

  select
    'meal_items'::text as source_table,
    id,
    name as row_name,
    portion as legacy_value,
    quantity,
    unit,
    null::numeric as grams_per_unit,
    case
      when quantity is not null and unit is not null then 'converted'
      else 'unconverted'
    end as conversion_status,
    concat_ws(
      ', ',
      case when quantity is null then 'quantity' end,
      case when unit is null then 'unit' end
    ) as missing_fields
  from public.meal_items
),
source_tables(source_table) as (
  values ('food_library'::text), ('meal_items'::text)
),
counts as (
  select
    source_table,
    count(*) filter (where conversion_status = 'converted') as converted_count,
    count(*) filter (where conversion_status = 'unconverted') as unconverted_count
  from audit_rows
  group by source_table
),
report as (
  select
    'summary'::text as report_row,
    source_tables.source_table,
    coalesce(counts.converted_count, 0::bigint) as converted_count,
    coalesce(counts.unconverted_count, 0::bigint) as unconverted_count,
    null::uuid as row_id,
    null::text as row_name,
    null::text as legacy_value,
    null::numeric as quantity,
    null::text as unit,
    null::numeric as grams_per_unit,
    null::text as missing_fields
  from source_tables
  left join counts using (source_table)

  union all

  select
    'unconverted_row'::text as report_row,
    audit_rows.source_table,
    null::bigint as converted_count,
    null::bigint as unconverted_count,
    audit_rows.id as row_id,
    audit_rows.row_name,
    audit_rows.legacy_value,
    audit_rows.quantity,
    audit_rows.unit,
    audit_rows.grams_per_unit,
    audit_rows.missing_fields
  from audit_rows
  where audit_rows.conversion_status = 'unconverted'
)
select
  report_row,
  source_table,
  converted_count,
  unconverted_count,
  row_id,
  row_name,
  legacy_value,
  quantity,
  unit,
  grams_per_unit,
  missing_fields
from report
order by
  source_table,
  case report_row when 'summary' then 0 else 1 end,
  row_name nulls first,
  row_id;
