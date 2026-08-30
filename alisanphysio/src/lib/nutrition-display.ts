import { t, type Lang } from "@/lib/i18n";
import { formatQuantityForDisplay } from "@/lib/nutrition-math";
import type { NutritionUnit } from "@/lib/types";

const PLURAL_UNITS = new Set<NutritionUnit>(["piece", "scoop", "cup"]);

/** Locale-aware structured portion label shared by staff and client surfaces. */
export function formatNutritionPortion(
  quantity: number,
  unit: NutritionUnit,
  lang: Lang,
): string {
  const key =
    Math.abs(quantity) !== 1 && PLURAL_UNITS.has(unit)
      ? `nutri.unit.${unit}Plural`
      : `nutri.unit.${unit}`;
  return `${formatQuantityForDisplay(quantity, lang)} ${t(lang, key)}`;
}
