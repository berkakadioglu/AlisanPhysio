"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type {
  FoodLibrary,
  NutritionUnit,
  NutritionValues,
} from "@/lib/types";
import {
  isNutritionUnit,
  parseQuantityInput,
  resolveItemNutrition,
} from "@/lib/nutrition-math";

type OptionalNumberInput = string | number | null | undefined;

const FOOD_LIBRARY_SELECT =
  "id, name, name_tr, default_portion, serving_qty, serving_unit, grams_per_unit, note, kcal, protein_g, carb_g, fat_g, created_at";

interface MealItemInput {
  id: string | null;
  name: string;
  portion: string | null;
  note: string | null;
  library_id: string | null;
  quantity: OptionalNumberInput;
  unit: NutritionUnit | null;
  isManualOverride: boolean;
  kcal: OptionalNumberInput;
  protein_g: OptionalNumberInput;
  carb_g: OptionalNumberInput;
  fat_g: OptionalNumberInput;
  /** Custom food the admin wants to persist to the food library for reuse. */
  saveToLibrary?: boolean;
}

interface MealInput {
  title: string;
  items: MealItemInput[];
}

interface SaveNutritionInput {
  clientId: string;
  notes: string;
  dailyKcalTarget: OptionalNumberInput;
  dailyProteinTarget: OptionalNumberInput;
  meals: MealInput[];
}

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

interface ParsedNutrition {
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
}

type ParsedMealItem = Omit<
  MealItemInput,
  "quantity" | "kcal" | "protein_g" | "carb_g" | "fat_g"
> &
  ParsedNutrition & {
    quantity: number | null;
    unit: NutritionUnit | null;
  };

interface StoredMealItem extends NutritionValues {
  id: string;
  library_id: string | null;
  quantity: number | null;
  unit: NutritionUnit | null;
  is_manual_override: boolean;
}

function parseOptionalNumber(
  value: OptionalNumberInput,
): number | null | undefined {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseOptionalTarget(
  value: OptionalNumberInput,
): number | null | undefined {
  const parsed = parseOptionalNumber(value);
  if (parsed === null || parsed === undefined) return parsed;
  return parsed > 0 ? parsed : undefined;
}

function parseOptionalQuantity(
  value: OptionalNumberInput,
): number | null | undefined {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return parseQuantityInput(value) ?? undefined;
}

function emptyNutrition(): ParsedNutrition {
  return { kcal: null, protein_g: null, carb_g: null, fat_g: null };
}

function parseNutrition(
  item: MealItemInput,
  lang: Lang,
): ParsedNutrition | string {
  const kcal = parseOptionalNumber(item.kcal);
  const protein_g = parseOptionalNumber(item.protein_g);
  const carb_g = parseOptionalNumber(item.carb_g);
  const fat_g = parseOptionalNumber(item.fat_g);
  if ([kcal, protein_g, carb_g, fat_g].some((value) => value === undefined)) {
    return t(lang, "nutri.invalidNutrition");
  }
  return {
    kcal: kcal ?? null,
    protein_g: protein_g ?? null,
    carb_g: carb_g ?? null,
    fat_g: fat_g ?? null,
  };
}

/**
 * Upsert the single nutrition plan for a client (one plan per user, enforced by
 * the UNIQUE client_id) plus its meals and items. Uses the staff session (RLS
 * *_staff_all authorizes it). Meals + items are replaced wholesale, which
 * cleanly handles add/remove/reorder at both levels. Mirrors saveProgram.
 */
export async function saveNutritionPlan(
  input: SaveNutritionInput,
): Promise<Result<{ planId: string }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();

  const dailyKcalTarget = parseOptionalTarget(input.dailyKcalTarget);
  if (dailyKcalTarget === undefined) {
    return { ok: false, error: t(lang, "nutri.invalidTarget") };
  }
  const dailyProteinTarget = parseOptionalTarget(input.dailyProteinTarget);
  if (dailyProteinTarget === undefined) {
    return { ok: false, error: t(lang, "nutri.invalidProteinTarget") };
  }

  // Validate every value before replacing any existing rows.
  const meals: Array<{
    title: string;
    items: ParsedMealItem[];
  }> = [];
  for (const meal of input.meals) {
    const items: ParsedMealItem[] = [];
    for (const item of meal.items.filter((candidate) => candidate.name.trim())) {
      const quantity = parseOptionalQuantity(item.quantity);
      if (quantity === undefined) {
        return { ok: false, error: t(lang, "nutri.invalidQuantity") };
      }
      const unit =
        item.unit === null
          ? null
          : isNutritionUnit(item.unit)
            ? item.unit
            : undefined;
      if (unit === undefined || (quantity === null) !== (unit === null)) {
        return { ok: false, error: t(lang, "nutri.invalidUnit") };
      }
      const nutrition = item.isManualOverride
        ? parseNutrition(item, lang)
        : emptyNutrition();
      if (typeof nutrition === "string") {
        return { ok: false, error: nutrition };
      }
      items.push({ ...item, quantity, unit, ...nutrition });
    }
    const title = meal.title.trim();
    if (title || items.length > 0) meals.push({ title, items });
  }

  const notes = input.notes.trim() || null;

  // Resolve linked foods on the server. Browser-submitted derived numbers are
  // never authoritative unless the coach explicitly enabled an override.
  const requestedLibraryIds = Array.from(
    new Set(
      meals.flatMap((meal) =>
        meal.items.flatMap((item) =>
          item.library_id ? [item.library_id] : [],
        ),
      ),
    ),
  );
  const foodById = new Map<string, FoodLibrary>();
  if (requestedLibraryIds.length > 0) {
    const { data: linkedFoods, error: linkedFoodError } = await supabase
      .from("food_library")
      .select(FOOD_LIBRARY_SELECT)
      .in("id", requestedLibraryIds)
      .returns<FoodLibrary[]>();
    if (linkedFoodError) {
      return { ok: false, error: linkedFoodError.message };
    }
    for (const food of linkedFoods ?? []) foodById.set(food.id, food);
  }

  // Resolve the existing plan (one per client) or create it.
  const { data: existingPlan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", input.clientId)
    .maybeSingle<{ id: string }>();

  let planId = existingPlan?.id;
  const storedItemById = new Map<string, StoredMealItem>();

  if (planId) {
    const { error } = await supabase
      .from("nutrition_plans")
      .update({
        notes,
        daily_kcal_target: dailyKcalTarget ?? null,
        daily_protein_target_g: dailyProteinTarget ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);
    if (error) return { ok: false, error: error.message };

    // Replace items then meals (items reference meals).
    const { data: mealRows } = await supabase
      .from("meals")
      .select("id")
      .eq("plan_id", planId)
      .returns<{ id: string }[]>();
    const mealIds = (mealRows ?? []).map((m) => m.id);
    if (mealIds.length > 0) {
      const { data: storedItems, error: storedItemsError } = await supabase
        .from("meal_items")
        .select(
          "id, library_id, quantity, unit, is_manual_override, kcal, protein_g, carb_g, fat_g",
        )
        .in("meal_id", mealIds)
        .returns<StoredMealItem[]>();
      if (storedItemsError) {
        return { ok: false, error: storedItemsError.message };
      }
      for (const item of storedItems ?? []) {
        storedItemById.set(item.id, item);
      }

      const { error: itemDelErr } = await supabase
        .from("meal_items")
        .delete()
        .in("meal_id", mealIds);
      if (itemDelErr) return { ok: false, error: itemDelErr.message };
    }
    const { error: mealDelErr } = await supabase
      .from("meals")
      .delete()
      .eq("plan_id", planId);
    if (mealDelErr) return { ok: false, error: mealDelErr.message };
  } else {
    const { data, error } = await supabase
      .from("nutrition_plans")
      .insert({
        client_id: input.clientId,
        notes,
        daily_kcal_target: dailyKcalTarget ?? null,
        daily_protein_target_g: dailyProteinTarget ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? t(lang, "nutri.createPlanError") };
    }
    planId = data.id as string;
  }

  // Insert meals, then their items (with the new meal_id + ordering).
  const itemRows: Array<Record<string, unknown>> = [];

  for (let mi = 0; mi < meals.length; mi++) {
    const meal = meals[mi];
    const { data: mealRow, error: mealErr } = await supabase
      .from("meals")
      .insert({
        plan_id: planId,
        title: meal.title || t(lang, "nutri.mealFallback"),
        order_index: mi,
      })
      .select("id")
      .single();
    if (mealErr || !mealRow) {
      return { ok: false, error: mealErr?.message ?? t(lang, "nutri.saveMealError") };
    }
    const mealId = mealRow.id as string;

    for (let ii = 0; ii < meal.items.length; ii++) {
      const it = meal.items[ii];
      const name = it.name.trim();
      let libraryId = it.library_id;
      let library = libraryId ? foodById.get(libraryId) ?? null : null;

      // Do not retain a stale/deleted link supplied by the browser.
      if (libraryId && !library) libraryId = null;

      // "Save to library" for a custom food → resolve/create the entry.
      if (!libraryId && it.saveToLibrary) {
        const { data: existing, error: existingError } = await supabase
          .from("food_library")
          .select(FOOD_LIBRARY_SELECT)
          .ilike("name", name)
          .limit(1)
          .maybeSingle<FoodLibrary>();
        if (existingError) {
          return { ok: false, error: existingError.message };
        }
        if (existing) {
          library = existing;
          libraryId = existing.id;
          foodById.set(existing.id, existing);
        } else {
          const { data: created, error: createError } = await supabase
            .from("food_library")
            .insert({
              name,
              default_portion:
                it.portion?.trim() ||
                (it.quantity !== null && it.unit
                  ? `${it.quantity} ${it.unit}`
                  : null),
              serving_qty: it.quantity,
              serving_unit: it.unit,
              grams_per_unit: null,
              kcal: null,
              protein_g: null,
              carb_g: null,
              fat_g: null,
            })
            .select(FOOD_LIBRARY_SELECT)
            .single<FoodLibrary>();
          if (createError) return { ok: false, error: createError.message };
          if (created) {
            library = created;
            libraryId = created.id;
            foodById.set(created.id, created);
          }
        }
      }

      const requestedManualOverride = Boolean(library && it.isManualOverride);
      const storedItem = it.id ? storedItemById.get(it.id) ?? null : null;
      const canUseStoredFallback = Boolean(
        library &&
          storedItem &&
          storedItem.library_id === library.id &&
          storedItem.quantity === it.quantity &&
          storedItem.unit === it.unit &&
          !storedItem.is_manual_override,
      );
      const resolved = resolveItemNutrition(
        {
          name,
          quantity: it.quantity,
          unit: it.unit,
          isManualOverride: requestedManualOverride,
          storedValues:
            requestedManualOverride || !canUseStoredFallback
              ? it
              : storedItem ?? emptyNutrition(),
          library,
        },
        { allowStoredFallback: canUseStoredFallback },
      );

      itemRows.push({
        meal_id: mealId,
        name,
        portion: it.portion?.trim() || null,
        note: it.note?.trim() || null,
        library_id: libraryId ?? null,
        quantity: it.quantity,
        unit: it.unit,
        is_manual_override: resolved.status === "manual_override",
        kcal: resolved.values.kcal,
        protein_g: resolved.values.protein_g,
        carb_g: resolved.values.carb_g,
        fat_g: resolved.values.fat_g,
        order_index: ii,
      });
    }
  }

  if (itemRows.length > 0) {
    const { error } = await supabase.from("meal_items").insert(itemRows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath(`/admin/clients/${input.clientId}/nutrition`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nutrition");
  return { ok: true, planId: planId! };
}

/** Delete a client's nutrition plan (meals + items cascade). */
export async function deleteNutritionPlan(input: {
  clientId: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();

  const { error } = await supabase
    .from("nutrition_plans")
    .delete()
    .eq("client_id", input.clientId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath(`/admin/clients/${input.clientId}/nutrition`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nutrition");
  return { ok: true };
}
