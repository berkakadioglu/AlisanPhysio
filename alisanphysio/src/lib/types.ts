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
  /** Standing height in cm, used to compute BMI. Null until the client sets it. */
  height_cm: number | null;
  /** Membership tier (admin-set). Null = no membership. */
  membership: Membership | null;
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

export interface Program {
  id: string;
  client_id: string;
  title: string;
  /** ISO date (YYYY-MM-DD) — the Monday of the program week. */
  week_start_date: string;
  notes: string | null;
  created_at: string;
}

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
export interface ProgramWithExercises extends Program {
  exercises: Exercise[];
}

/** A reusable exercise Alişan picks from, optionally with a demo video. */
export interface ExerciseLibrary {
  id: string;
  name: string;
  youtube_url: string | null;
  default_instructions: string | null;
  created_at: string;
}

export type NotificationType =
  | "membership_expiry"
  | "missing_info"
  | "weekly_review"
  | "manual";

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

/** Snapshot of a program / exercise stored in a review (survives later edits). */
export interface ReviewProgramRef {
  id: string;
  title: string;
}
export interface ReviewExerciseRef {
  id: string;
  name: string;
}

/** A client's self-reported review of one completed week. */
export interface WeeklyReview {
  id: string;
  user_id: string;
  /** ISO date (YYYY-MM-DD) — the Monday of the reviewed week. */
  week_start: string;
  days_attended: number | null;
  programs_done: ReviewProgramRef[];
  hard_exercises: ReviewExerciseRef[];
  note: string | null;
  created_at: string;
}
