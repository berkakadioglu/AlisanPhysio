"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { countShownLibraryVideo, type LibrarySyncValues } from "@/lib/library-sync";
import { isRichTextEmpty } from "@/lib/rich-text";
import { normalizeYouTubeUrl, parseYouTubeId } from "@/lib/youtube";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { missingSavedDayColumn } from "@/lib/templates";
import type { ExerciseLibrary, LibraryExercise } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

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

// ---------------------------------------------------------------------------
// Library sync: "Update library exercise" / "Add to library" on a programme
// editor row (rules in src/lib/library-sync.ts). Every action is staff-gated
// first and checks its ids before any query.
// ---------------------------------------------------------------------------

const SYNC_PAGE = 1000;

type QueryError = { code?: string; message?: string } | null;
type DayVideoRow = { template_id: string; media_url: string | null };

/** Trimmed text, or null when it is empty or not a string. */
function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Every row of a query, paged so the row cap cannot lower a count. */
async function everyRow<R>(
  page: (from: number, to: number) => PromiseLike<{ data: R[] | null; error: QueryError }>,
): Promise<{ rows: R[]; error: QueryError }> {
  const rows: R[] = [];
  for (let from = 0; ; from += SYNC_PAGE) {
    const { data, error } = await page(from, from + SYNC_PAGE - 1);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < SYNC_PAGE) return { rows, error: null };
  }
}

/**
 * How many programmes and live saved days show this library entry's video
 * through their exercise (rows with no YouTube video of their own). Read
 * before the coach confirms an update that changes the video.
 */
export async function libraryExerciseUsage(input: {
  id: string;
}): Promise<Result<{ programmes: number; savedDays: number }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  if (!isProgramId(input.id)) return { ok: false, error: t(lang, "lib.sync.gone") };

  const exercises = await everyRow<{ program_id: string; media_url: string | null }>((from, to) =>
    supabase
      .from("exercises")
      .select("program_id, media_url")
      .eq("library_id", input.id)
      .order("id")
      .range(from, to)
      .returns<{ program_id: string; media_url: string | null }[]>(),
  );
  if (exercises.error) {
    console.error("libraryExerciseUsage", exercises.error);
    return { ok: false, error: t(lang, "lib.sync.countFailed") };
  }

  // Only live saved days count (deleted_at arrives with migration 0021).
  const liveDays = await everyRow<DayVideoRow>((from, to) =>
    supabase
      .from("day_template_exercises")
      .select("template_id, media_url, day_templates!inner(deleted_at)")
      .eq("library_id", input.id)
      .is("day_templates.deleted_at", null)
      .order("id")
      .range(from, to)
      .returns<DayVideoRow[]>(),
  );
  // Before 0021 there is no deleted_at, so every saved day is live.
  const days =
    liveDays.error && missingSavedDayColumn(liveDays.error)
      ? await everyRow<DayVideoRow>((from, to) =>
          supabase
            .from("day_template_exercises")
            .select("template_id, media_url")
            .eq("library_id", input.id)
            .order("id")
            .range(from, to)
            .returns<DayVideoRow[]>(),
        )
      : liveDays;
  if (days.error) {
    console.error("libraryExerciseUsage", days.error);
    return { ok: false, error: t(lang, "lib.sync.countFailed") };
  }

  return {
    ok: true,
    programmes: countShownLibraryVideo(
      exercises.rows.map((row) => ({ owner: row.program_id, media_url: row.media_url })),
    ),
    savedDays: countShownLibraryVideo(
      days.rows.map((row) => ({ owner: row.template_id, media_url: row.media_url })),
    ),
  };
}

/**
 * "Update library exercise": writes only the fields the coach's row pushes
 * (cues and/or a YouTube video) and returns the old and new values so the
 * editor can offer Undo.
 */
export async function updateLibraryFromExercise(input: {
  id: string;
  instructions?: string | null;
  videoUrl?: string | null;
}): Promise<Result<{ name: string; previous: LibrarySyncValues; next: LibrarySyncValues }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  if (!isProgramId(input.id)) return { ok: false, error: t(lang, "lib.sync.gone") };

  const { data: entry, error: readError } = await supabase
    .from("exercise_library")
    .select("id, name, default_instructions, youtube_url")
    .eq("id", input.id)
    .maybeSingle<Pick<ExerciseLibrary, "id" | "name" | "default_instructions" | "youtube_url">>();
  if (readError) {
    console.error("updateLibraryFromExercise", readError);
    return { ok: false, error: t(lang, "lib.sync.updateError") };
  }
  if (!entry) return { ok: false, error: t(lang, "lib.sync.gone") };

  const patch: LibrarySyncValues = {};
  const previous: LibrarySyncValues = {};
  const next: LibrarySyncValues = {};

  if (input.instructions !== undefined) {
    const text = textOrNull(input.instructions) ?? "";
    if (isRichTextEmpty(text)) return { ok: false, error: t(lang, "lib.sync.updateError") };
    patch.default_instructions = text;
    previous.default_instructions = entry.default_instructions;
    next.default_instructions = text;
  }

  if (input.videoUrl !== undefined) {
    const url = typeof input.videoUrl === "string" ? normalizeYouTubeUrl(input.videoUrl) : null;
    if (!url) return { ok: false, error: t(lang, "err.notYouTube") };
    patch.youtube_url = url;
    previous.youtube_url = entry.youtube_url;
    next.youtube_url = url;
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: t(lang, "lib.sync.updateError") };

  const { data, error } = await supabase
    .from("exercise_library")
    .update(patch)
    .eq("id", input.id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) {
    console.error("updateLibraryFromExercise", error);
    return { ok: false, error: t(lang, "lib.sync.updateError") };
  }
  if (!data) return { ok: false, error: t(lang, "lib.sync.gone") };

  revalidatePath("/admin/library");
  return { ok: true, name: entry.name, previous, next };
}

/** Undo of an update: writes the previous values back, only for the given keys. */
export async function restoreLibraryExercise(input: {
  id: string;
  values: { default_instructions?: string | null; youtube_url?: string | null };
}): Promise<Result<{ name: string }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  if (!isProgramId(input.id)) return { ok: false, error: t(lang, "lib.sync.gone") };

  const values = input.values ?? {};
  const patch: LibrarySyncValues = {};
  if (values.default_instructions !== undefined) {
    if (values.default_instructions === null) patch.default_instructions = null;
    else if (typeof values.default_instructions === "string") {
      patch.default_instructions = values.default_instructions.trim() || null;
    } else return { ok: false, error: t(lang, "lib.sync.undoError") };
  }
  if (values.youtube_url !== undefined) {
    if (values.youtube_url === null) patch.youtube_url = null;
    else {
      const url = typeof values.youtube_url === "string" ? normalizeYouTubeUrl(values.youtube_url) : null;
      if (!url) return { ok: false, error: t(lang, "lib.sync.undoError") };
      patch.youtube_url = url;
    }
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: t(lang, "lib.sync.undoError") };

  const { data, error } = await supabase
    .from("exercise_library")
    .update(patch)
    .eq("id", input.id)
    .select("id, name")
    .maybeSingle<{ id: string; name: string }>();
  if (error) {
    console.error("restoreLibraryExercise", error);
    return { ok: false, error: t(lang, "lib.sync.undoError") };
  }
  if (!data) return { ok: false, error: t(lang, "lib.sync.gone") };

  revalidatePath("/admin/library");
  return { ok: true, name: data.name };
}

/**
 * "Add to library" from an unlinked row: a new entry from its name, cues and
 * YouTube video. A non-YouTube link stays on the row and is not stored here.
 */
export async function addExerciseToLibrary(input: {
  name: string;
  instructions: string | null;
  videoUrl: string | null;
}): Promise<Result<{ entry: LibraryExercise }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: t(lang, "err.giveExerciseName") };

  const youtube_url = parseYouTubeId(input.videoUrl) ? normalizeYouTubeUrl(input.videoUrl ?? "") : null;
  const { data, error } = await supabase
    .from("exercise_library")
    .insert({ name, default_instructions: textOrNull(input.instructions), youtube_url })
    .select("id, name, youtube_url, default_instructions, created_at")
    .single<ExerciseLibrary>();
  if (error) {
    if (error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate")) {
      return { ok: false, error: t(lang, "lib.sync.exists", { name }) };
    }
    console.error("addExerciseToLibrary", error);
    return { ok: false, error: t(lang, "lib.sync.addError") };
  }

  revalidatePath("/admin/library");
  return { ok: true, entry: { ...data, category_ids: [] } };
}

/**
 * Undo of "Add to library": deletes the entry. exercises and day-template rows
 * that pointed at it keep their names (library_id is ON DELETE SET NULL).
 */
export async function removeAddedLibraryExercise(input: { id: string }): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  if (!isProgramId(input.id)) return { ok: false, error: t(lang, "lib.sync.undoError") };

  const { error } = await supabase.from("exercise_library").delete().eq("id", input.id);
  if (error) {
    console.error("removeAddedLibraryExercise", error);
    return { ok: false, error: t(lang, "lib.sync.undoError") };
  }

  revalidatePath("/admin/library");
  return { ok: true };
}
