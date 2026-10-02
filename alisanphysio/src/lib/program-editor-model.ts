/**
 * The shapes the shared programme / saved-day editor works with. Kept in a
 * plain module (no React) so server pages, server actions, the saved-day
 * helpers and the editor component all agree on one contract.
 */

/** One exercise as the editor saves it (also the unit a saved day copies). */
export interface EditorExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
}

/** One training day. */
export interface EditorDay {
  title: string;
  /**
   * Name of the saved day this day was copied from, shown as a quiet origin
   * line. Informational only — never used to link content.
   */
  sourceTemplateLabel: string | null;
  exercises: EditorExercise[];
}

/** What a programme editor page hands the editor. */
export interface EditorInitial {
  title: string;
  monthStartDate: string;
  notes: string;
  days: EditorDay[];
}
