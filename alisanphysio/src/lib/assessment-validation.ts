import {
  EQUIPMENT_ACCESS_VALUES,
  SEX_VALUES,
  TRAINING_EXPERIENCE_VALUES,
  type AssessmentField,
  type AssessmentInsert,
  normalizeAssessmentPlan,
  type AssessmentSubmissionInput,
} from "@/lib/assessment";

export type AssessmentValidationCode =
  | "requiredName"
  | "invalidEmail"
  | "requiredGoal"
  | "requiredExpectation"
  | "requiredConsent"
  | "invalidValue";

export type AssessmentValidationResult =
  | { ok: true; data: AssessmentInsert }
  | {
      ok: false;
      abuse: boolean;
      errors: Partial<Record<AssessmentField, AssessmentValidationCode>>;
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_SUBMIT_TIME_MS = 2_500;

function requiredText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean.length <= maxLength ? clean : null;
}

function optionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (!clean) return null;
  return clean.length <= maxLength ? clean : undefined;
}

function optionalNumber(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max ||
    (integer && !Number.isInteger(parsed))
  ) {
    return undefined;
  }
  return parsed;
}

function isOneOf(value: string | null, allowed: readonly string[]) {
  return value === null || allowed.includes(value);
}

export function validateAssessmentInput(
  input: AssessmentSubmissionInput,
  now = Date.now(),
): AssessmentValidationResult {
  const errors: Partial<
    Record<AssessmentField, AssessmentValidationCode>
  > = {};

  const honeypot = typeof input.website === "string" ? input.website.trim() : "";
  const startedAt = Number(input.started_at);
  const abuse =
    honeypot.length > 0 ||
    !Number.isFinite(startedAt) ||
    startedAt <= 0 ||
    startedAt > now ||
    now - startedAt < MIN_SUBMIT_TIME_MS;

  if (abuse) return { ok: false, abuse: true, errors: {} };

  const fullName = requiredText(input.full_name, 120);
  if (!fullName) errors.full_name = "requiredName";

  const email = requiredText(input.email, 254)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) errors.email = "invalidEmail";

  const primaryGoal = requiredText(input.primary_goal, 1_500);
  if (!primaryGoal) errors.primary_goal = "requiredGoal";
  const expectation = requiredText(input.biggest_expectation, 1500);
  if (!expectation) errors.biggest_expectation = "requiredExpectation";

  if (input.consent !== true) errors.consent = "requiredConsent";

  const phone = optionalText(input.phone, 40);
  const country = optionalText(input.country, 80);
  const city = optionalText(input.city, 80);
  const sex = optionalText(input.sex, 40);
  const trainingExperience = optionalText(input.training_experience, 30);
  const equipmentAccess = optionalText(input.equipment_access, 30);
  const injuryHistory = optionalText(input.injury_history, 3_000);
  const medicalNotes = optionalText(input.medical_notes, 3_000);
  const message = optionalText(input.message, 3_000);
  const birthYear = optionalNumber(
    input.birth_year,
    1900,
    new Date(now).getUTCFullYear(),
    true,
  );
  const heightCm = optionalNumber(input.height_cm, 50, 260);
  const weightKg = optionalNumber(input.weight_kg, 20, 500);
  const daysPerWeek = optionalNumber(input.days_per_week, 1, 7, true);

  const optionalFields: Array<[
    AssessmentField,
    string | number | null | undefined,
  ]> = [
    ["phone", phone],
    ["country", country],
    ["city", city],
    ["sex", sex],
    ["training_experience", trainingExperience],
    ["equipment_access", equipmentAccess],
    ["injury_history", injuryHistory],
    ["medical_notes", medicalNotes],
    ["message", message],
    ["birth_year", birthYear],
    ["height_cm", heightCm],
    ["weight_kg", weightKg],
    ["days_per_week", daysPerWeek],
  ];
  optionalFields.forEach(([field, value]) => {
    if (value === undefined) errors[field] = "invalidValue";
  });

  if (!isOneOf(sex ?? null, SEX_VALUES)) errors.sex = "invalidValue";
  if (!isOneOf(trainingExperience ?? null, TRAINING_EXPERIENCE_VALUES)) {
    errors.training_experience = "invalidValue";
  }
  if (!isOneOf(equipmentAccess ?? null, EQUIPMENT_ACCESS_VALUES)) {
    errors.equipment_access = "invalidValue";
  }

  const selectedPlan = normalizeAssessmentPlan(input.selected_plan);

  const preferredLanguage =
    input.preferred_language === "en" || input.preferred_language === "tr"
      ? input.preferred_language
      : null;
  if (!preferredLanguage) errors.preferred_language = "invalidValue";

  if (
    Object.keys(errors).length > 0 ||
    !fullName ||
    !email ||
    !primaryGoal ||
    !expectation ||
    !preferredLanguage
  ) {
    return { ok: false, abuse: false, errors };
  }

  return {
    ok: true,
    data: {
      full_name: fullName,
      email,
      phone: phone ?? null,
      country: country ?? null,
      city: city ?? null,
      preferred_language: preferredLanguage,
      birth_year: birthYear ?? null,
      sex: sex ?? null,
      height_cm: heightCm ?? null,
      weight_kg: weightKg ?? null,
      primary_goal: primaryGoal,
      biggest_expectation: expectation,
      training_experience: trainingExperience ?? null,
      days_per_week: daysPerWeek ?? null,
      equipment_access: equipmentAccess ?? null,
      injury_history: injuryHistory ?? null,
      medical_notes: medicalNotes ?? null,
      selected_plan: selectedPlan,
      message: message ?? null,
    },
  };
}
