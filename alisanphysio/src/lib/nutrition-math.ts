import type {
  MealItem,
  NutritionUnit,
  NutritionValues,
} from "@/lib/types";

export type { NutritionUnit } from "@/lib/types";

/** Runtime counterpart to `NutritionUnit`, shared by selects and validation. */
export const NUTRITION_UNITS = [
  "g",
  "ml",
  "piece",
  "scoop",
  "tbsp",
  "tsp",
  "cup",
] as const satisfies readonly NutritionUnit[];

const NUTRITION_UNIT_SET = new Set<string>(NUTRITION_UNITS);

export const NUTRITION_FIELDS = [
  "kcal",
  "protein_g",
  "carb_g",
  "fat_g",
] as const;

export type NutritionField = (typeof NUTRITION_FIELDS)[number];

const EMPTY_NUTRITION: NutritionValues = {
  kcal: null,
  protein_g: null,
  carb_g: null,
  fat_g: null,
};

const NON_MASS_UNITS = new Set<NutritionUnit>([
  "piece",
  "scoop",
  "tbsp",
  "tsp",
  "cup",
]);

export interface LibraryNutritionReference extends NutritionValues {
  serving_qty: number | null;
  serving_unit: NutritionUnit | null;
  grams_per_unit: number | null;
}

export interface ItemNutritionInput {
  /** Optional name lets total helpers ignore blank editor rows. */
  name?: string | null;
  quantity: number | null;
  unit: NutritionUnit | null;
  isManualOverride: boolean;
  storedValues: NutritionValues;
  library: LibraryNutritionReference | null;
}

export type NutritionUnavailableReason =
  | "unlinked"
  | "missing_library_nutrition"
  | "missing_quantity"
  | "invalid_quantity"
  | "missing_item_unit"
  | "missing_serving_quantity"
  | "invalid_serving_quantity"
  | "missing_serving_unit"
  | "mass_volume_mismatch"
  | "missing_gram_equivalent"
  | "incompatible_units";

export type QuantityConversionReason = Extract<
  NutritionUnavailableReason,
  | "missing_quantity"
  | "invalid_quantity"
  | "missing_item_unit"
  | "mass_volume_mismatch"
  | "missing_gram_equivalent"
  | "incompatible_units"
>;

export interface QuantityConversionInput {
  quantity: number | null;
  fromUnit: NutritionUnit | null;
  toUnit: NutritionUnit | null;
  /**
   * The non-mass unit that `gramsPerUnit` describes. For a library row this is
   * its `serving_unit` (for example, piece when one piece weighs 118 g).
   */
  gramEquivalentUnit: NutritionUnit | null;
  gramsPerUnit: number | null;
}

export interface QuantityConversionResult {
  quantity: number | null;
  status: "same_unit" | "converted" | "unavailable";
  reason: QuantityConversionReason | null;
  needsGramEquivalent: boolean;
}

export interface PortionFactorInput {
  quantity: number | null;
  unit: NutritionUnit | null;
  servingQty: number | null;
  servingUnit: NutritionUnit | null;
  gramsPerUnit: number | null;
}

export interface PortionFactorResult {
  factor: number | null;
  convertedQuantity: number | null;
  status: "exact" | "unavailable";
  reason: NutritionUnavailableReason | null;
  needsGramEquivalent: boolean;
}

export interface ResolveItemNutritionOptions {
  /**
   * Preserve snapshots for an already-saved, structured row whose current
   * units cannot be converted. Live editors should pass false after quantity
   * or unit changes so stale values disappear instead of looking calculated.
   */
  allowStoredFallback?: boolean;
}

export interface ResolvedItemNutrition extends NutritionValues {
  values: NutritionValues;
  status:
    | "derived"
    | "manual_override"
    | "stored_fallback"
    | "unavailable";
  reason: NutritionUnavailableReason | null;
  factor: number | null;
  needsGramEquivalent: boolean;
  hasAny: boolean;
  isComplete: boolean;
}

export interface NutritionTotals extends NutritionValues {
  hasAny: boolean;
  isComplete: boolean;
  isPartial: boolean;
  itemCount: number;
  completeItemCount: number;
  incompleteItemCount: number;
  missingItemCount: number;
  fieldComplete: Record<NutritionField, boolean>;
}

/** Short aliases retained for editor/view call sites. */
export type ResolvedNutrition = ResolvedItemNutrition;
export type NutritionAggregate = NutritionTotals;

function knownNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function positiveNumber(value: number | null): value is number {
  return knownNumber(value) && value > 0;
}

function sanitizedValues(values: NutritionValues): NutritionValues {
  return {
    kcal: knownNumber(values.kcal) ? values.kcal : null,
    protein_g: knownNumber(values.protein_g) ? values.protein_g : null,
    carb_g: knownNumber(values.carb_g) ? values.carb_g : null,
    fat_g: knownNumber(values.fat_g) ? values.fat_g : null,
  };
}

export function hasNutritionValues(values: NutritionValues): boolean {
  return NUTRITION_FIELDS.some((field) => knownNumber(values[field]));
}

export function hasCompleteNutritionValues(values: NutritionValues): boolean {
  return NUTRITION_FIELDS.every((field) => knownNumber(values[field]));
}

export function isNutritionUnit(value: unknown): value is NutritionUnit {
  return typeof value === "string" && NUTRITION_UNIT_SET.has(value);
}

export function parseQuantityInput(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Parse an optional kcal/macro editor value; legitimate zero remains known. */
export function parseNutritionValueInput(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function nutritionValueToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

export function quantityToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

export function formatQuantityForDisplay(
  value: number,
  lang: "en" | "tr" = "en",
): string {
  return new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Convert only when the supplied equivalence makes the conversion exact.
 * `gramsPerUnit` is never treated as a millilitre value and g↔ml is rejected.
 */
export function convertQuantity({
  quantity,
  fromUnit,
  toUnit,
  gramEquivalentUnit,
  gramsPerUnit,
}: QuantityConversionInput): QuantityConversionResult {
  if (quantity === null) {
    return unavailableConversion("missing_quantity");
  }
  if (!positiveNumber(quantity)) {
    return unavailableConversion("invalid_quantity");
  }
  if (!fromUnit || !toUnit) {
    return unavailableConversion("missing_item_unit");
  }
  if (fromUnit === toUnit) {
    return {
      quantity,
      status: "same_unit",
      reason: null,
      needsGramEquivalent: false,
    };
  }
  if (
    (fromUnit === "g" && toUnit === "ml") ||
    (fromUnit === "ml" && toUnit === "g")
  ) {
    return unavailableConversion("mass_volume_mismatch");
  }

  const equivalentIsNonMass =
    gramEquivalentUnit !== null && NON_MASS_UNITS.has(gramEquivalentUnit);
  const usesKnownGramPair =
    equivalentIsNonMass &&
    ((fromUnit === gramEquivalentUnit && toUnit === "g") ||
      (fromUnit === "g" && toUnit === gramEquivalentUnit));

  if (usesKnownGramPair && !positiveNumber(gramsPerUnit)) {
    return unavailableConversion("missing_gram_equivalent", true);
  }
  if (usesKnownGramPair) {
    // The preceding branch rules out null, zero, negative and non-finite data.
    const exactGramsPerUnit = gramsPerUnit as number;
    return {
      quantity:
        fromUnit === "g"
          ? quantity / exactGramsPerUnit
          : quantity * exactGramsPerUnit,
      status: "converted",
      reason: null,
      needsGramEquivalent: false,
    };
  }

  // A gram equivalent says nothing about volume or a different count unit.
  if (fromUnit === "ml" || toUnit === "ml") {
    return unavailableConversion("mass_volume_mismatch");
  }
  return unavailableConversion("incompatible_units");
}

function unavailableConversion(
  reason: QuantityConversionReason,
  needsGramEquivalent = false,
): QuantityConversionResult {
  return {
    quantity: null,
    status: "unavailable",
    reason,
    needsGramEquivalent,
  };
}

export function calculatePortionFactor({
  quantity,
  unit,
  servingQty,
  servingUnit,
  gramsPerUnit,
}: PortionFactorInput): PortionFactorResult {
  if (servingQty === null) {
    return unavailableFactor("missing_serving_quantity");
  }
  if (!positiveNumber(servingQty)) {
    return unavailableFactor("invalid_serving_quantity");
  }
  if (!servingUnit) {
    return unavailableFactor("missing_serving_unit");
  }

  const conversion = convertQuantity({
    quantity,
    fromUnit: unit,
    toUnit: servingUnit,
    gramEquivalentUnit: servingUnit,
    gramsPerUnit,
  });
  if (conversion.quantity === null) {
    return unavailableFactor(
      conversion.reason ?? "incompatible_units",
      conversion.needsGramEquivalent,
    );
  }
  return {
    factor: conversion.quantity / servingQty,
    convertedQuantity: conversion.quantity,
    status: "exact",
    reason: null,
    needsGramEquivalent: false,
  };
}

function unavailableFactor(
  reason: NutritionUnavailableReason,
  needsGramEquivalent = false,
): PortionFactorResult {
  return {
    factor: null,
    convertedQuantity: null,
    status: "unavailable",
    reason,
    needsGramEquivalent,
  };
}

/** Exact, unrounded values for one quantity of a library entry. */
export function deriveNutritionValues(
  library: LibraryNutritionReference,
  quantity: number | null,
  unit: NutritionUnit | null,
): ResolvedItemNutrition {
  const libraryValues = sanitizedValues(library);
  if (!hasNutritionValues(libraryValues)) {
    return unavailableNutrition("missing_library_nutrition");
  }

  const factor = calculatePortionFactor({
    quantity,
    unit,
    servingQty: library.serving_qty,
    servingUnit: library.serving_unit,
    gramsPerUnit: library.grams_per_unit,
  });
  if (factor.factor === null) {
    return unavailableNutrition(
      factor.reason ?? "incompatible_units",
      factor.needsGramEquivalent,
    );
  }

  const values: NutritionValues = {
    kcal:
      libraryValues.kcal === null
        ? null
        : libraryValues.kcal * factor.factor,
    protein_g:
      libraryValues.protein_g === null
        ? null
        : libraryValues.protein_g * factor.factor,
    carb_g:
      libraryValues.carb_g === null
        ? null
        : libraryValues.carb_g * factor.factor,
    fat_g:
      libraryValues.fat_g === null
        ? null
        : libraryValues.fat_g * factor.factor,
  };
  return resolvedNutrition(values, "derived", null, factor.factor, false);
}

/**
 * Resolve the effective values for an editor/client item. Stored snapshots are
 * authoritative only for an explicit override (or the opt-in persisted-row
 * fallback); all ordinary calculations come from the linked library entry.
 */
export function resolveItemNutrition(
  input: ItemNutritionInput,
  options: ResolveItemNutritionOptions = {},
): ResolvedItemNutrition {
  const { library } = input;
  if (!library) return unavailableNutrition("unlinked");

  const libraryValues = sanitizedValues(library);
  if (!hasNutritionValues(libraryValues)) {
    return unavailableNutrition("missing_library_nutrition");
  }

  // Structured quantity/unit are required even for an override. This keeps an
  // unconverted legacy row on its text-only portion fallback.
  if (input.quantity === null) {
    return unavailableNutrition("missing_quantity");
  }
  if (!positiveNumber(input.quantity)) {
    return unavailableNutrition("invalid_quantity");
  }
  if (!input.unit) return unavailableNutrition("missing_item_unit");

  if (input.isManualOverride) {
    return resolvedNutrition(
      sanitizedValues(input.storedValues),
      "manual_override",
      null,
      null,
      false,
    );
  }

  const derived = deriveNutritionValues(library, input.quantity, input.unit);
  if (derived.status !== "unavailable") return derived;

  if (
    options.allowStoredFallback === true &&
    hasNutritionValues(sanitizedValues(input.storedValues))
  ) {
    return resolvedNutrition(
      sanitizedValues(input.storedValues),
      "stored_fallback",
      derived.reason,
      null,
      derived.needsGramEquivalent,
    );
  }
  return derived;
}

/** Persisted-row adapter. Legacy text-only rows still resolve to no numbers. */
export function resolveMealItemNutrition(
  item: MealItem,
  options: ResolveItemNutritionOptions = { allowStoredFallback: true },
): ResolvedItemNutrition {
  return resolveItemNutrition(
    {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      isManualOverride: item.is_manual_override,
      storedValues: item,
      library: item.food_library,
    },
    options,
  );
}

function unavailableNutrition(
  reason: NutritionUnavailableReason,
  needsGramEquivalent = false,
): ResolvedItemNutrition {
  return resolvedNutrition(
    EMPTY_NUTRITION,
    "unavailable",
    reason,
    null,
    needsGramEquivalent,
  );
}

function resolvedNutrition(
  values: NutritionValues,
  status: ResolvedItemNutrition["status"],
  reason: NutritionUnavailableReason | null,
  factor: number | null,
  needsGramEquivalent: boolean,
): ResolvedItemNutrition {
  const clean = sanitizedValues(values);
  return {
    ...clean,
    values: clean,
    status,
    reason,
    factor,
    needsGramEquivalent,
    hasAny: hasNutritionValues(clean),
    isComplete: hasCompleteNutritionValues(clean),
  };
}

/**
 * Sum known values without turning unknown data into zero. A total is partial
 * whenever it contains at least one known value and any included item is not
 * complete across all four nutrition fields.
 */
export function sumNutritionTotals(
  rows: ReadonlyArray<NutritionValues>,
): NutritionTotals {
  const totals: NutritionValues = { ...EMPTY_NUTRITION };
  const fieldComplete: Record<NutritionField, boolean> = {
    kcal: rows.length > 0,
    protein_g: rows.length > 0,
    carb_g: rows.length > 0,
    fat_g: rows.length > 0,
  };
  let completeItemCount = 0;
  let missingItemCount = 0;

  for (const row of rows) {
    const clean = sanitizedValues(row);
    const rowHasAny = hasNutritionValues(clean);
    const rowComplete = hasCompleteNutritionValues(clean);
    if (rowComplete) completeItemCount += 1;
    if (!rowHasAny) missingItemCount += 1;

    for (const field of NUTRITION_FIELDS) {
      const value = clean[field];
      if (value === null) {
        fieldComplete[field] = false;
      } else {
        totals[field] = (totals[field] ?? 0) + value;
      }
    }
  }

  const hasAny = hasNutritionValues(totals);
  const incompleteItemCount = rows.length - completeItemCount;
  const isComplete = hasAny && rows.length > 0 && incompleteItemCount === 0;
  return {
    ...totals,
    hasAny,
    isComplete,
    isPartial: hasAny && !isComplete,
    itemCount: rows.length,
    completeItemCount,
    incompleteItemCount,
    missingItemCount,
    fieldComplete,
  };
}

/** Blank editor rows are not nutrition items and do not make totals partial. */
export function calculateMealTotals(
  items: ReadonlyArray<ItemNutritionInput>,
  options: ResolveItemNutritionOptions = {},
): NutritionTotals {
  const namedItems = items.filter(
    (item) => item.name === undefined || Boolean(item.name?.trim()),
  );
  return sumNutritionTotals(
    namedItems.map((item) => resolveItemNutrition(item, options).values),
  );
}

export function calculateDayTotals(
  meals: ReadonlyArray<{ items: ReadonlyArray<ItemNutritionInput> }>,
  options: ResolveItemNutritionOptions = {},
): NutritionTotals {
  return calculateMealTotals(
    meals.flatMap((meal) => [...meal.items]),
    options,
  );
}

/** Return the old free-text portion only when structured display is impossible. */
export function legacyPortionFallback(item: {
  quantity: number | null;
  unit: NutritionUnit | null;
  portion: string | null;
}): string | null {
  return item.quantity === null || item.unit === null
    ? item.portion?.trim() || null
    : null;
}

export function roundNutritionForDisplay(
  field: NutritionField,
  value: number,
): number {
  return field === "kcal"
    ? Math.round(value)
    : Math.round((value + Number.EPSILON) * 10) / 10;
}

export function formatNutritionForDisplay(
  field: NutritionField,
  value: number,
  lang: "en" | "tr" = "en",
): string {
  const rounded = roundNutritionForDisplay(field, value);
  return new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: field === "kcal" ? 0 : 1,
    maximumFractionDigits: field === "kcal" ? 0 : 1,
  }).format(rounded);
}
