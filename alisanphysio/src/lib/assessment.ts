import type { Lang } from "@/lib/i18n";

export const ASSESSMENT_STATUSES = [
  "new",
  "contacted",
  "accepted",
  "declined",
] as const;

export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type AssessmentPlan = "monthly" | "quarterly";

export const TRAINING_EXPERIENCE_VALUES = [
  "none",
  "under-1y",
  "1-3y",
  "3y-plus",
] as const;

export const EQUIPMENT_ACCESS_VALUES = [
  "full-gym",
  "home-basic",
  "none",
  "other",
] as const;

export const SEX_VALUES = [
  "female",
  "male",
  "non-binary",
  "prefer-not-to-say",
] as const;

export interface AssessmentFormValues {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  birth_year: string;
  sex: string;
  height_cm: string;
  weight_kg: string;
  primary_goal: string;
  training_experience: string;
  days_per_week: string;
  equipment_access: string;
  injury_history: string;
  medical_notes: string;
  selected_plan: AssessmentPlan | "";
  message: string;
}

export type AssessmentField =
  | keyof AssessmentFormValues
  | "preferred_language"
  | "consent";

export interface AssessmentSubmissionInput extends AssessmentFormValues {
  preferred_language: unknown;
  consent: unknown;
  website: unknown;
  started_at: unknown;
}

export interface AssessmentInsert {
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  preferred_language: Lang;
  birth_year: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  primary_goal: string;
  training_experience: string | null;
  days_per_week: number | null;
  equipment_access: string | null;
  injury_history: string | null;
  medical_notes: string | null;
  selected_plan: AssessmentPlan | null;
  message: string | null;
}

export interface AssessmentRequest extends AssessmentInsert {
  id: string;
  created_at: string;
  status: AssessmentStatus;
  admin_note: string | null;
  reviewed_at: string | null;
}

export function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return ASSESSMENT_STATUSES.includes(value as AssessmentStatus);
}
