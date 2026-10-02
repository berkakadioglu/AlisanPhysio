import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise, ProgramDay } from "@/lib/types";
import type { EditorDay } from "@/lib/program-editor-model";
import { missingCatalogColumn } from "@/lib/catalog-compatibility";
import { editorDays } from "@/lib/program-editor-data";

const DAY_COLS = "id, program_id, title, order_index, created_at";
const EXERCISE_COLS = "id, program_id, name, sets, reps, instructions, media_url, order_index, library_id, day_id";

/**
 * A programme's days as the editor edits them: value copies (no row ids), each
 * with its saved-day origin label. Before migration 0021 there is no
 * source_template_label column; the days then load without an origin.
 */
export async function loadEditorDays(
  supabase: SupabaseClient,
  programId: string,
  ungroupedTitle: string,
): Promise<EditorDay[]> {
  const loadDays = (cols: string) => supabase.from("program_days").select(cols)
    .eq("program_id", programId).order("order_index").returns<ProgramDay[]>();
  const [firstDays, exercises] = await Promise.all([
    loadDays(`${DAY_COLS}, source_template_label`),
    supabase.from("exercises").select(EXERCISE_COLS).eq("program_id", programId)
      .order("order_index").returns<Exercise[]>(),
  ]);
  const days = missingCatalogColumn(firstDays.error, "source_template_label")
    ? await loadDays(DAY_COLS)
    : firstDays;
  if (days.error || exercises.error) throw new Error("Could not load programme exercises");
  return editorDays(days.data ?? [], exercises.data ?? [], ungroupedTitle).map((day) => ({
    title: day.title,
    sourceTemplateLabel: day.sourceTemplateLabel,
    exercises: day.exercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      instructions: e.instructions,
      media_url: e.media_url,
      library_id: e.library_id,
    })),
  }));
}
