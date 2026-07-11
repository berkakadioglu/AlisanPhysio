/**
 * WHO Body Mass Index categories. Purely informational; the copy shown to
 * users is neutral and non-judgmental (see the bmi.* i18n keys).
 */

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export const BMI_CATEGORIES: BmiCategory[] = [
  "underweight",
  "normal",
  "overweight",
  "obese",
];

/** Classify a BMI value into a WHO category. */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

/** BMI = weight(kg) / height(m)². Returns null if inputs are missing/invalid. */
export function computeBmi(
  weightKg: number | null,
  heightCm: number | null,
): number | null {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
}
