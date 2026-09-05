import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise, ProgramDay } from "@/lib/types";
import { editorDays } from "@/lib/program-editor-data";
export async function loadEditorDays(supabase: SupabaseClient, programId: string, ungroupedTitle: string) {
  const [days, exercises] = await Promise.all([
    supabase.from("program_days").select("id, program_id, title, order_index, created_at").eq("program_id", programId).order("order_index").returns<ProgramDay[]>(),
    supabase.from("exercises").select("id, program_id, name, sets, reps, instructions, media_url, order_index, library_id, day_id").eq("program_id", programId).order("order_index").returns<Exercise[]>(),
  ]);
  if (days.error || exercises.error) throw new Error("Could not load programme exercises");
  return editorDays(days.data ?? [], exercises.data ?? [], ungroupedTitle);
}
