/**
 * Compatibility facade for the first macro pass.
 *
 * Quantity conversion, derivation, totals, parsing, and rounding now live in
 * nutrition-math.ts so the admin editor and client view share one arithmetic
 * implementation. New call sites should import that module directly.
 */
import type { NutritionValues } from "@/lib/types";
import {
  formatNutritionForDisplay,
  hasCompleteNutritionValues,
  hasNutritionValues,
  NUTRITION_FIELDS,
  nutritionValueToInput,
  parseNutritionValueInput,
  sumNutritionTotals,
  type NutritionField,
  type NutritionTotals,
} from "@/lib/nutrition-math";

export {
  hasCompleteNutritionValues,
  hasNutritionValues,
  NUTRITION_FIELDS,
  nutritionValueToInput,
  type NutritionField,
  type NutritionTotals,
};

export function sumNutritionValues(
  rows: ReadonlyArray<NutritionValues>,
): NutritionTotals {
  return sumNutritionTotals(rows);
}

export function isNutritionFieldComplete(
  rows: ReadonlyArray<NutritionValues>,
  field: NutritionField,
): boolean {
  return sumNutritionTotals(rows).fieldComplete[field];
}

export const nutritionValueFromInput = parseNutritionValueInput;

/** @deprecated Use field-aware formatNutritionForDisplay from nutrition-math. */
export function formatNutritionValue(
  value: number,
  lang: "en" | "tr" = "en",
): string {
  return formatNutritionForDisplay("protein_g", value, lang);
}
