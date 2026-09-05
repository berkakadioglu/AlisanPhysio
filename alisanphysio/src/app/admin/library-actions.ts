"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { normalizeYouTubeUrl } from "@/lib/youtube";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

type Result = { ok: true } | { ok: false; error: string };

function validate(
  input: { name: string; youtubeUrl: string; defaultInstructions: string },
  lang: Lang,
): { name: string; youtube_url: string | null; default_instructions: string | null } | string {
  const name = input.name.trim();
  if (!name) return t(lang, "err.giveExerciseName");

  const rawUrl = input.youtubeUrl.trim();
  let youtube_url: string | null = null;
  if (rawUrl) {
    const normalized = normalizeYouTubeUrl(rawUrl);
    if (!normalized) return t(lang, "err.notYouTube");
    youtube_url = normalized;
  }

  return {
    name,
    youtube_url,
    default_instructions: input.defaultInstructions.trim() || null,
  };
}

/** Replace an exercise's category mappings with the given set (staff session). */
async function setExerciseCategories(
  supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"],
  exerciseId: string,
  categoryIds: string[],
): Promise<string | null> {
  const { error: delErr } = await supabase
    .from("exercise_category_map")
    .delete()
    .eq("exercise_id", exerciseId);
  if (delErr) return delErr.message;

  const ids = [...new Set(categoryIds.filter(Boolean))];
  if (ids.length === 0) return null;

  const { error: insErr } = await supabase
    .from("exercise_category_map")
    .insert(ids.map((category_id) => ({ exercise_id: exerciseId, category_id })));
  return insErr?.message ?? null;
}

export async function createLibraryExercise(input: {
  name: string;
  youtubeUrl: string;
  defaultInstructions: string;
  categoryIds?: string[];
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const { data, error } = await supabase
    .from("exercise_library")
    .insert(parsed)
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, error: t(lang, "err.exerciseExists") };
    }
    return { ok: false, error: error.message };
  }

  const mapErr = await setExerciseCategories(supabase, data.id, input.categoryIds ?? []);
  if (mapErr) return { ok: false, error: mapErr };

  revalidatePath("/admin/library");
  return { ok: true };
}

export async function updateLibraryExercise(input: {
  id: string;
  name: string;
  youtubeUrl: string;
  defaultInstructions: string;
  categoryIds?: string[];
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const { error } = await supabase
    .from("exercise_library")
    .update(parsed)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const mapErr = await setExerciseCategories(supabase, input.id, input.categoryIds ?? []);
  if (mapErr) return { ok: false, error: mapErr };

  revalidatePath("/admin/library");
  return { ok: true };
}

export async function deleteLibraryExercise(input: {
  id: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();
  // exercises.library_id is ON DELETE SET NULL, so past programs keep their name.
  // exercise_category_map rows cascade away with the exercise.
  const { error } = await supabase
    .from("exercise_library")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/library");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categories (staff-gated; all stored categories are editable)
// ---------------------------------------------------------------------------

export async function createCategory(input: { name: string }): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const name = input.name.trim();
  if (!name) return { ok: false, error: t(lang, "err.giveCategoryName") };

  // Avoid confusing near-duplicates (case-insensitive) with an existing one.
  const { data: existing } = await supabase
    .from("exercise_categories")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { ok: false, error: t(lang, "err.categoryExists") };

  const { error } = await supabase
    .from("exercise_categories")
    .insert({ name, is_default: false });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/library");
  return { ok: true };
}

export async function renameCategory(input: {
  id: string;
  name: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const name = input.name.trim();
  if (!name) return { ok: false, error: t(lang, "err.giveCategoryName") };

  const { error } = await supabase
    .from("exercise_categories")
    .update({ name })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/library");
  return { ok: true };
}

export async function deleteCategory(input: { id: string }): Promise<Result> {
  const { supabase } = await requireStaff();

  // Mappings cascade away; exercises are untouched.
  const { error } = await supabase
    .from("exercise_categories")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/library");
  return { ok: true };
}
