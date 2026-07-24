"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

interface TemplateExerciseInput {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
  /** Custom exercise the admin wants to persist to the library for reuse. */
  saveToLibrary?: boolean;
}

interface SaveTemplateInput {
  id?: string; // present when editing
  title: string;
  exercises: TemplateExerciseInput[];
}

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

/**
 * Create or update a day template with its exercises. Staff-gated. Exercises
 * are replaced wholesale on edit (clean add/remove/reorder). Mirrors the
 * program editor's save so "save to library" behaves identically.
 */
export async function saveTemplate(
  input: SaveTemplateInput,
): Promise<Result<{ templateId: string }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();

  const title = input.title.trim();
  if (!title) return { ok: false, error: t(lang, "err.giveTemplateTitle") };

  // Keep only named exercises.
  const exercises = input.exercises.filter((e) => e.name.trim() !== "");

  let templateId = input.id;

  if (templateId) {
    const { error } = await supabase
      .from("day_templates")
      .update({ title })
      .eq("id", templateId);
    if (error) return { ok: false, error: error.message };

    const { error: delErr } = await supabase
      .from("day_template_exercises")
      .delete()
      .eq("template_id", templateId);
    if (delErr) return { ok: false, error: delErr.message };
  } else {
    const { data, error } = await supabase
      .from("day_templates")
      .insert({ title })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not create template." };
    }
    templateId = data.id;
  }

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < exercises.length; i++) {
    const e = exercises[i];
    const name = e.name.trim();
    const instructions = e.instructions?.trim() || null;
    let libraryId = e.library_id;

    // "Save to library" for a custom exercise → resolve/create the entry.
    if (!libraryId && e.saveToLibrary) {
      const { data: existing } = await supabase
        .from("exercise_library")
        .select("id")
        .eq("name", name)
        .maybeSingle();
      if (existing) {
        libraryId = existing.id as string;
      } else {
        const { data: created } = await supabase
          .from("exercise_library")
          .insert({ name, default_instructions: instructions })
          .select("id")
          .single();
        if (created) libraryId = created.id as string;
      }
    }

    rows.push({
      template_id: templateId,
      name,
      sets: e.sets,
      reps: e.reps?.trim() || null,
      instructions,
      media_url: e.media_url?.trim() || null,
      library_id: libraryId ?? null,
      order_index: i,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("day_template_exercises")
      .insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/templates");
  return { ok: true, templateId: templateId! };
}

/** Delete a template (its exercises cascade). Programs already built from it
 *  keep their copied days — nothing there references the template. */
export async function deleteTemplate(input: {
  id: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("day_templates")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}
