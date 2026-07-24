import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DayTemplate,
  DayTemplateExercise,
  TemplateSummary,
  TemplateWithExercises,
} from "@/lib/types";

const EXERCISE_COLS =
  "id, template_id, name, library_id, sets, reps, instructions, media_url, order_index";

/** All templates (title + exercise count) for the list page, newest first. */
export async function loadTemplateSummaries(
  supabase: SupabaseClient,
): Promise<TemplateSummary[]> {
  const [{ data: templates }, { data: exRows }] = await Promise.all([
    supabase
      .from("day_templates")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .returns<DayTemplate[]>(),
    supabase
      .from("day_template_exercises")
      .select("template_id")
      .returns<{ template_id: string }[]>(),
  ]);

  const counts = new Map<string, number>();
  for (const r of exRows ?? [])
    counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1);

  return (templates ?? []).map((tpl) => ({
    ...tpl,
    count: counts.get(tpl.id) ?? 0,
  }));
}

/** A single template with its ordered exercises (template editor). */
export async function loadTemplate(
  supabase: SupabaseClient,
  id: string,
): Promise<TemplateWithExercises | null> {
  const { data: tpl } = await supabase
    .from("day_templates")
    .select("id, title, created_at")
    .eq("id", id)
    .maybeSingle<DayTemplate>();
  if (!tpl) return null;

  const { data: exercises } = await supabase
    .from("day_template_exercises")
    .select(EXERCISE_COLS)
    .eq("template_id", id)
    .order("order_index", { ascending: true })
    .returns<DayTemplateExercise[]>();

  return { ...tpl, exercises: exercises ?? [] };
}

/**
 * Every template with its exercises, for the program editor's "Add from
 * template" picker (deep-copied into a new day client-side). Templates are a
 * small, staff-curated set, so loading them all is cheap.
 */
export async function loadTemplatesForPicker(
  supabase: SupabaseClient,
): Promise<TemplateWithExercises[]> {
  const [{ data: templates }, { data: exRows }] = await Promise.all([
    supabase
      .from("day_templates")
      .select("id, title, created_at")
      .order("title", { ascending: true })
      .returns<DayTemplate[]>(),
    supabase
      .from("day_template_exercises")
      .select(EXERCISE_COLS)
      .order("order_index", { ascending: true })
      .returns<DayTemplateExercise[]>(),
  ]);

  const byTemplate = new Map<string, DayTemplateExercise[]>();
  for (const e of exRows ?? []) {
    const arr = byTemplate.get(e.template_id) ?? [];
    arr.push(e);
    byTemplate.set(e.template_id, arr);
  }

  return (templates ?? []).map((tpl) => ({
    ...tpl,
    exercises: byTemplate.get(tpl.id) ?? [],
  }));
}
