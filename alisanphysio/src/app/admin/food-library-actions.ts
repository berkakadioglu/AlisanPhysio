"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { isNutritionUnit } from "@/lib/nutrition-math";
import type { NutritionUnit } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

function validate(
  input: FoodInput,
  lang: Lang,
):
  | {
      name: string;
      name_tr: string | null;
      default_portion: string | null;
      serving_qty: number | null;
      serving_unit: NutritionUnit | null;
      grams_per_unit: number | null;
      note: string | null;
      kcal: number | null;
      protein_g: number | null;
      carb_g: number | null;
      fat_g: number | null;
    }
  | string {
  const name = input.name.trim();
  if (!name) return t(lang, "err.giveFoodName");

  const nutrition = parseNutrition(input);
  if (!nutrition) return t(lang, "food.invalidNutrition");

  const servingQty = parseOptionalPositiveNumber(input.servingQty);
  const gramsPerUnit = parseOptionalPositiveNumber(input.gramsPerUnit);
  const rawUnit = input.servingUnit.trim();
  const servingUnit = rawUnit && isNutritionUnit(rawUnit) ? rawUnit : null;
  const hasInvalidUnit = Boolean(rawUnit) && servingUnit === null;
  const hasIncompleteServing = (servingQty === null) !== (servingUnit === null);
  if (
    servingQty === undefined ||
    gramsPerUnit === undefined ||
    hasInvalidUnit ||
    hasIncompleteServing
  ) {
    return t(lang, "food.invalidServing");
  }

  return {
    name,
    name_tr: input.nameTr.trim() || null,
    default_portion: input.defaultPortion.trim() || null,
    serving_qty: servingQty,
    serving_unit: servingUnit,
    grams_per_unit:
      servingUnit && !["g", "ml"].includes(servingUnit)
        ? gramsPerUnit
        : null,
    note: input.note.trim() || null,
    ...nutrition,
  };
}

interface FoodInput {
  name: string;
  nameTr: string;
  defaultPortion: string;
  servingQty: string;
  servingUnit: string;
  gramsPerUnit: string;
  note: string;
  kcal: string;
  proteinG: string;
  carbG: string;
  fatG: string;
}

function parseOptionalNumber(raw: string): number | null | undefined {
  const value = raw.trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseOptionalPositiveNumber(raw: string): number | null | undefined {
  const value = parseOptionalNumber(raw);
  if (value === null || value === undefined) return value;
  return value > 0 ? value : undefined;
}

function parseNutrition(input: FoodInput) {
  const kcal = parseOptionalNumber(input.kcal);
  const protein_g = parseOptionalNumber(input.proteinG);
  const carb_g = parseOptionalNumber(input.carbG);
  const fat_g = parseOptionalNumber(input.fatG);
  if ([kcal, protein_g, carb_g, fat_g].some((value) => value === undefined)) {
    return null;
  }
  return {
    kcal: kcal ?? null,
    protein_g: protein_g ?? null,
    carb_g: carb_g ?? null,
    fat_g: fat_g ?? null,
  };
}

export async function createFood(input: FoodInput): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  // Avoid confusing near-duplicates (case-insensitive).
  const { data: existing } = await supabase
    .from("food_library")
    .select("id")
    .ilike("name", parsed.name)
    .maybeSingle();
  if (existing) return { ok: false, error: t(lang, "err.foodExists") };

  const { error } = await supabase.from("food_library").insert(parsed);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/food-library");
  revalidatePath("/dashboard/nutrition");
  return { ok: true };
}

export async function updateFood(input: FoodInput & { id: string }): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const { error } = await supabase
    .from("food_library")
    .update(parsed)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/food-library");
  revalidatePath("/dashboard/nutrition");
  return { ok: true };
}

export async function deleteFood(input: { id: string }): Promise<Result> {
  const { supabase } = await requireStaff();
  // meal_items.library_id is ON DELETE SET NULL, so plans keep the food's name.
  const { error } = await supabase
    .from("food_library")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/food-library");
  return { ok: true };
}
