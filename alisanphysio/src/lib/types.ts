/**
 * Hand-written row types mirroring the SQL schema in
 * /supabase/migrations. Once the schema is live you can replace these with
 * generated types via: `npx supabase gen types typescript`.
 */

import type { Membership } from "@/lib/membership";

export type Role = "admin" | "manager" | "client";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  /** IANA timezone used for all viewer-local scheduling times. */
  timezone: string | null;
  /** Standing height in cm, used to compute BMI. Null until the client sets it. */
  height_cm: number | null;
  /** Membership tier (admin-set). Null = no membership. */
  membership: Membership | null;
  nutrition_enabled: boolean;
  /** ISO date (YYYY-MM-DD) the membership lapses; null = no expiry. Admin-set. */
  membership_end_date: string | null;
}

/** A single weigh-in / tape-measure session (weight + optional circumferences). */
export interface Measurement {
  id: string;
  client_id: string;
  /** ISO date (YYYY-MM-DD) the measurement was taken. */
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  chest_cm: number | null;
  created_at: string;
}

/** A timestamped note the client writes for Alişan (pain, how they feel, issues). */
export interface Complaint {
  id: string;
  client_id: string;
  body: string;
  created_at: string;
}

interface ProgramBase {
  id: string;
  /** Informational origin of an independent copy; never used to resolve content. */
  source_program_id?: string | null;
  updated_at?: string;
  title: string;
  notes: string | null;
  created_at: string;
}
export interface ClientProgram extends ProgramBase {
  kind: "client";
  client_id: string;
  month_start_date: string;
}
export interface CatalogProgram extends ProgramBase {
  kind: "catalog";
  client_id: null;
  month_start_date: null;
}
export type Program = ClientProgram | CatalogProgram;

export interface Exercise {
  id: string;
  program_id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  order_index: number;
  /** Optional link back to a library entry (for its demo video). */
  library_id: string | null;
  /** Optional grouping day within the program. */
  day_id: string | null;
}

/** An optional named grouping of exercises within a program. */
export interface ProgramDay {
  id: string;
  program_id: string;
  title: string | null;
  order_index: number;
  created_at: string;
}

/** A program with its ordered exercises attached. */
export type ProgramWithExercises = Program & { exercises: Exercise[] };

/** A reusable exercise Alişan picks from, optionally with a demo video. */
export interface ExerciseLibrary {
  id: string;
  name: string;
  youtube_url: string | null;
  default_instructions: string | null;
  created_at: string;
}

/** A muscle-group / purpose tag for library exercises (many-to-many). */
export interface ExerciseCategory {
  id: string;
  name: string;
  /** Legacy metadata only; it does not change category display or editing. */
  is_default: boolean;
  created_at: string;
}

/** A library exercise plus the ids of the categories it's tagged with. */
export interface LibraryExercise extends ExerciseLibrary {
  category_ids: string[];
}

/** A category plus how many library exercises are tagged with it. */
export interface CategoryWithCount extends ExerciseCategory {
  count: number;
}

/** A reusable "day blueprint" (e.g. "Push Day") staff can drop into a program. */
export interface DayTemplate {
  id: string;
  title: string;
  created_at: string;
}

/** An exercise inside a day template, with its default prescription. */
export interface DayTemplateExercise {
  id: string;
  template_id: string;
  name: string;
  library_id: string | null;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  order_index: number;
}

/** A template with its ordered exercises attached (editor + program picker). */
export interface TemplateWithExercises extends DayTemplate {
  exercises: DayTemplateExercise[];
}

/** A template plus its exercise count (list page). */
export interface TemplateSummary extends DayTemplate {
  count: number;
}

// ---------------------------------------------------------------------------
// Nutrition. plan → meals → items, one plan per user. Meal-item nutrition
// columns hold manual overrides and safe fallbacks; ordinary linked rows are
// derived from their structured quantity and current library serving.
// ---------------------------------------------------------------------------

export interface NutritionValues {
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
}

/** Units accepted by the structured nutrition portion model. */
export type NutritionUnit =
  | "g"
  | "ml"
  | "piece"
  | "scoop"
  | "tbsp"
  | "tsp"
  | "cup";

/** A shared, staff-curated food (mirrors ExerciseLibrary, simpler). */
export interface FoodLibrary extends NutritionValues {
  id: string;
  /** Canonical English name. */
  name: string;
  /** Optional Turkish display name; English is the fallback. */
  name_tr: string | null;
  /** A sensible default serving, e.g. "1 cup" / "150 g". Null if unset. */
  default_portion: string | null;
  /** Numeric serving that the library nutrition values describe. */
  serving_qty: number | null;
  /** Structured unit for `serving_qty`; null on an unconverted legacy row. */
  serving_unit: NutritionUnit | null;
  /** Gram mass of one non-mass serving unit, when known. */
  grams_per_unit: number | null;
  note: string | null;
  created_at: string;
}

/** A user's single current nutrition plan (container: notes + meals). */
export interface NutritionPlan {
  id: string;
  client_id: string;
  notes: string | null;
  daily_kcal_target: number | null;
  daily_protein_target_g: number | null;
  updated_at: string;
  created_at: string;
}

/** An ordered meal within a plan (Breakfast/Lunch/Dinner/Snack or custom). */
export interface Meal {
  id: string;
  plan_id: string;
  title: string;
  order_index: number;
  created_at: string;
}

/** A food row inside a meal, optionally linked to a food_library entry. */
export interface MealItem extends NutritionValues {
  id: string;
  meal_id: string;
  name: string;
  library_id: string | null;
  /** Structured amount; null when this legacy row could not be converted. */
  quantity: number | null;
  /** Structured amount unit; null when this legacy row could not be converted. */
  unit: NutritionUnit | null;
  /** Stored nutrition snapshots win until staff explicitly clear the override. */
  is_manual_override: boolean;
  portion: string | null;
  note: string | null;
  order_index: number;
  /** Localized library names when the optional link still exists. */
  food_library: Pick<
    FoodLibrary,
    | "name"
    | "name_tr"
    | "serving_qty"
    | "serving_unit"
    | "grams_per_unit"
    | "kcal"
    | "protein_g"
    | "carb_g"
    | "fat_g"
  > | null;
}

/** A meal with its ordered items attached. */
export interface MealWithItems extends Meal {
  items: MealItem[];
}

/** A plan with its ordered meals (each with items) — editor + client view. */
export interface NutritionPlanWithMeals extends NutritionPlan {
  meals: MealWithItems[];
}

export type NotificationType =
  | "membership_expiry"
  | "missing_info"
  | "program_review"
  | "manual"
  | "availability"
  | "appointment_reminder"
  | "appointment_cancelled";

/** An in-app notification. A user only ever sees their own. */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** Optional in-app route to open when clicked. */
  link: string | null;
  read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Availability requests ("meeting requests") — staff ask a client when they're
// free for a given week; the client answers with day + free-form time ranges.
// ---------------------------------------------------------------------------

/** A staff-sent request asking one client about one week's availability. */
export interface AvailabilityRequest {
  id: string;
  client_id: string;
  /** ISO date (YYYY-MM-DD) — the Monday of the asked-about week. */
  week_start: string;
  created_by: string | null;
  created_at: string;
}

/** One day the client marked available, with a free-form time range + note. */
export interface AvailabilitySlot {
  id: string;
  request_id: string;
  /** ISO date (YYYY-MM-DD) — a specific day within the request's week. */
  day_date: string;
  time_from: string | null;
  time_to: string | null;
  note: string | null;
  created_at: string;
}

/** A request with its submitted slots attached. */
export interface AvailabilityRequestWithSlots extends AvailabilityRequest {
  slots: AvailabilitySlot[];
}

// ---------------------------------------------------------------------------
// Scheduling. These names deliberately distinguish the new bookable slots
// from the legacy AvailabilitySlot response rows above while the migration
// preserves old availability-request history.
// ---------------------------------------------------------------------------

export type SchedulingMode = "coach_slots" | "client_proposal";
export type BookableSlotStatus = "open" | "booked" | "closed";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";
export type AppointmentCancelledBy = "client" | "coach";
export type ClientProposalStatus = "pending" | "accepted" | "declined";
export type AppointmentReminderKind = "24h" | "12h";

/** Single-row scheduling preferences owned by the coach/staff UI. */
export interface CoachSettings {
  scheduling_mode: SchedulingMode;
  default_duration_min: number;
  /** Coach's IANA timezone. */
  timezone: string;
}

/** A concrete UTC slot published by the coach for Mode A booking. */
export interface BookableAvailabilitySlot {
  id: string;
  created_at: string;
  starts_at: string;
  duration_min: number;
  status: BookableSlotStatus;
  note: string | null;
}

/** A real appointment. All timestamps are UTC ISO strings from timestamptz. */
export interface Appointment {
  id: string;
  created_at: string;
  client_id: string;
  coach_id: string | null;
  slot_id: string | null;
  starts_at: string;
  duration_min: number;
  status: AppointmentStatus;
  meeting_url: string | null;
  agenda: string | null;
  coach_note: string | null;
  cancelled_by: AppointmentCancelledBy | null;
  cancelled_reason: string | null;
  cancelled_at: string | null;
}

/** Client-facing row shape; the private coach note is never selected. */
export type ClientAppointment = Omit<Appointment, "coach_note">;

export type SchedulingClientSummary = Pick<
  Profile,
  "id" | "full_name" | "timezone"
>;

/** Staff appointment query with client timezone/name embedded. */
export interface AppointmentWithClient extends Appointment {
  client: SchedulingClientSummary | null;
}

/** A client-authored candidate time in Mode B. */
export interface ClientProposal {
  id: string;
  created_at: string;
  client_id: string;
  proposal_group_id: string;
  proposed_start: string;
  note: string | null;
  status: ClientProposalStatus;
  decision_note: string | null;
  decided_at: string | null;
  accepted_appointment_id: string | null;
}

/** Staff proposal query with client timezone/name embedded. */
export interface ClientProposalWithClient extends ClientProposal {
  client: SchedulingClientSummary | null;
}

/** Snapshot of a program / exercise stored in a review (survives later edits). */
export interface ReviewProgramRef {
  id: string;
  title: string;
}
export interface ReviewExerciseRef {
  id: string;
  name: string;
}

/** A single submitted monthly review, tied to its client programme. */
export interface ProgramReview {
  id: string;
  client_id: string;
  program_id: string;
  days_attended: number | null;
  programs_done: ReviewProgramRef[];
  hard_exercises: ReviewExerciseRef[];
  note: string | null;
  created_at: string;
  programs?: { title: string; month_start_date: string } | null;
}
