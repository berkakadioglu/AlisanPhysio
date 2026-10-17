"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { missingCatalogColumn } from "@/lib/catalog-compatibility";
import { isProgramId } from "@/lib/catalog-programs";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { EditorExercise } from "@/lib/program-editor-model";
import {
  SAVED_DAY_TITLE_MAX,
  findSavedDayConflict,
  findSavedDayNameChangeConflict,
  nextCopyName,
} from "@/lib/saved-days";
import {
  loadLiveTemplateTitles,
  missingSavedDayColumn,
  missingSavedDayFunction,
} from "@/lib/templates";

/**
 * Saved days ("day templates"): save, save-from-a-programme-day (with the
 * same-name conflict choice), undo, soft delete, restore, rename. All
 * staff-gated; errors are localized. Saving and inserting are always copies —
 * nothing here links a saved day to a programme.
 *
 * Compatibility before migration 0021: saving falls back to the old
 * sequential inserts; replace / soft delete / restore need the migration and
 * say so (sd.needsMigration).
 */

type ExerciseInput = EditorExercise & {
  /** Custom exercise the coach wants persisted to the library for reuse. */
  saveToLibrary?: boolean;
};

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_EXERCISES = 200;
const SAVED_DAYS_PATH = "/admin/programs";

function fail(lang: Lang, key: string, params?: Record<string, string | number>): { ok: false; error: string } {
  return { ok: false, error: t(lang, key, params) };
}

function revalidateSavedDays(id?: string) {
  revalidatePath(SAVED_DAYS_PATH);
  if (id) revalidatePath(`${SAVED_DAYS_PATH}/saved-days/${id}`);
}

/** The named exercises a save keeps, trimmed, in the shape the RPC expects. */
function cleanExercises(list: readonly ExerciseInput[]) {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return list
    .filter((e) => typeof e?.name === "string" && e.name.trim() !== "")
    .map((e) => {
      const sets = typeof e.sets === "string" ? Number(e.sets) : e.sets;
      const libraryId = isProgramId(e.library_id) ? e.library_id : null;
      return {
        name: e.name.trim(),
        sets: Number.isInteger(sets) && (sets as number) >= 0 ? (sets as number) : null,
        reps: text(e.reps),
        instructions: text(e.instructions),
        media_url: text(e.media_url),
        library_id: libraryId,
        saveToLibrary: !libraryId && !!e.saveToLibrary,
      };
    });
}
type CleanExercise = ReturnType<typeof cleanExercises>[number];

/** Shared input checks: a name and at least one named exercise. */
function validate(lang: Lang, rawTitle: unknown, rawExercises: unknown) {
  const title = typeof rawTitle === "string" ? rawTitle.trim().replace(/\s+/gu, " ") : "";
  if (!title) return fail(lang, "sd.nameRequired");
  if (title.length > SAVED_DAY_TITLE_MAX) return fail(lang, "sd.nameTooLong", { max: SAVED_DAY_TITLE_MAX });
  if (!Array.isArray(rawExercises)) return fail(lang, "sd.emptyDay");
  const exercises = cleanExercises(rawExercises as ExerciseInput[]);
  if (exercises.length === 0) return fail(lang, "sd.emptyDay");
  if (exercises.length > MAX_EXERCISES) return fail(lang, "sd.tooManyExercises", { max: MAX_EXERCISES });
  return { ok: true as const, title, exercises };
}

/**
 * The pre-0021 path: sequential writes (not atomic). A new template whose
 * exercises fail to insert is removed again so no empty saved day is left.
 */
async function legacySave(
  supabase: SupabaseClient,
  id: string | null,
  title: string,
  exercises: CleanExercise[],
): Promise<{ id: string | null; error: unknown }> {
  let templateId = id;
  if (templateId) {
    const { data, error } = await supabase.from("day_templates").update({ title })
      .eq("id", templateId).select("id").maybeSingle();
    if (error) return { id: null, error };
    if (!data) return { id: null, error: { code: "P0002" } };
    const { error: delErr } = await supabase.from("day_template_exercises").delete()
      .eq("template_id", templateId);
    if (delErr) return { id: null, error: delErr };
  } else {
    const { data, error } = await supabase.from("day_templates").insert({ title })
      .select("id").single<{ id: string }>();
    if (error || !data) return { id: null, error: error ?? { code: "unknown" } };
    templateId = data.id;
  }

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < exercises.length; i++) {
    const e = exercises[i];
    let libraryId = e.library_id;
    // "Save to library" for a custom exercise → resolve/create the entry.
    if (!libraryId && e.saveToLibrary) {
      const { data: existing } = await supabase.from("exercise_library").select("id")
        .eq("name", e.name).maybeSingle<{ id: string }>();
      if (existing) libraryId = existing.id;
      else {
        const { data: created } = await supabase.from("exercise_library")
          .insert({ name: e.name, default_instructions: e.instructions })
          .select("id").single<{ id: string }>();
        if (created) libraryId = created.id;
      }
    }
    rows.push({
      template_id: templateId, name: e.name, sets: e.sets, reps: e.reps,
      instructions: e.instructions, media_url: e.media_url, library_id: libraryId, order_index: i,
    });
  }
  const { error } = await supabase.from("day_template_exercises").insert(rows);
  if (error) {
    if (!id) await supabase.from("day_templates").delete().eq("id", templateId);
    return { id: null, error };
  }
  return { id: templateId, error: null };
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P0002";
}

/** A programme day, by its programme and 0-based position (order_index). */
type ProgramDayLink = { programId: string; dayIndex: number };

function isValidDayLink(link: ProgramDayLink): boolean {
  return isProgramId(link.programId) && Number.isInteger(link.dayIndex) && link.dayIndex >= 0;
}

/**
 * Points the programme day at the saved day it was saved as (0022). The id is
 * only used to offer "Update saved day", so a failure never fails the save: the
 * day just stays unlinked. True only when exactly one day was linked.
 */
async function linkProgramDay(
  supabase: SupabaseClient,
  link: ProgramDayLink,
  templateId: string,
): Promise<boolean> {
  if (!isValidDayLink(link)) return false;
  try {
    const { data, error } = await supabase.from("program_days")
      .update({ source_template_id: templateId })
      .eq("program_id", link.programId).eq("order_index", link.dayIndex)
      .select("id").returns<{ id: string }[]>();
    if (error) {
      if (!missingCatalogColumn(error, "source_template_id")) {
        console.error("Saved day could not be linked to its programme day", error);
      }
      return false;
    }
    return data?.length === 1;
  } catch (error) {
    console.error("Saved day could not be linked to its programme day", error);
    return false;
  }
}

/**
 * The Undo of a link: the programme day gets its previous saved day back. The
 * FK cleared the link when the new saved day was deleted; the is-null guard
 * keeps a link that was set again in the meantime. Errors are only logged.
 */
async function restoreProgramDayLink(
  supabase: SupabaseClient,
  link: ProgramDayLink & { previousTemplateId: string | null },
): Promise<void> {
  if (!isValidDayLink(link) || !isProgramId(link.previousTemplateId)) return;
  try {
    const { error } = await supabase.from("program_days")
      .update({ source_template_id: link.previousTemplateId })
      .eq("program_id", link.programId).eq("order_index", link.dayIndex)
      .is("source_template_id", null);
    if (error && !missingCatalogColumn(error, "source_template_id")) {
      console.error("Saved day link could not be restored on its programme day", error);
    }
  } catch (error) {
    console.error("Saved day link could not be restored on its programme day", error);
  }
}

/**
 * Create or update a saved day from the saved-day editor. Exercises are
 * replaced wholesale (clean add / remove / reorder) in one transaction via
 * save_day_template. Only live saved days can be edited.
 */
export async function saveTemplate(input: {
  id?: string;
  title: string;
  exercises: ExerciseInput[];
}): Promise<Result<{ templateId: string }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (input.id !== undefined && input.id !== null && !isProgramId(input.id)) return fail(lang, "sd.notFound");
  const checked = validate(lang, input.title, input.exercises);
  if (!checked.ok) return checked;
  const id = input.id ?? null;

  try {
    // Live names stay unique, like rename / restore / "Save day as template".
    // Only a new saved day or an actual name change is checked, so a legacy
    // duplicate (from the old template editor) can still have its exercises
    // saved without being renamed first.
    const { rows: live } = await loadLiveTemplateTitles(supabase);
    if (findSavedDayNameChangeConflict(checked.title, live, id)) {
      return fail(lang, "sd.nameTaken", { name: checked.title });
    }

    const { data, error } = await supabase.rpc("save_day_template", {
      p_id: id, p_title: checked.title, p_exercises: checked.exercises,
      p_source_label: null, p_replace_id: null,
    });
    let templateId: string | null = isProgramId(data) ? data : null;
    let failure: unknown = error;
    if (missingSavedDayFunction(error, "save_day_template")) {
      const legacy = await legacySave(supabase, id, checked.title, checked.exercises);
      templateId = legacy.id;
      failure = legacy.error;
    }
    if (failure || !templateId) {
      if (!isNotFound(failure)) console.error("Saved day could not be saved", failure);
      return fail(lang, isNotFound(failure) ? "sd.notFound" : "sd.saveError");
    }
    revalidateSavedDays(templateId);
    return { ok: true, templateId };
  } catch (error) {
    console.error("Saved day could not be saved", error);
    return fail(lang, "sd.saveError");
  }
}

/**
 * "Save day as template" from any programme editor. Re-checks the live name
 * conflict on the server: without a replace choice a conflicting name is saved
 * as the next free copy name ("Push Day (2)"); `replaceId` moves that live
 * saved day to Recently deleted in the same transaction. Returns the final
 * name and what was replaced, for the toast and its Undo. With `link`, the
 * programme day it came from is pointed at the new saved day (`linked`).
 */
export async function saveDayAsTemplate(input: {
  title: string;
  exercises: ExerciseInput[];
  sourceLabel: string | null;
  replaceId?: string | null;
  link?: ProgramDayLink | null;
}): Promise<Result<{ templateId: string; title: string; replacedId: string | null; linked: boolean }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  const checked = validate(lang, input.title, input.exercises);
  if (!checked.ok) return checked;
  const sourceLabel = typeof input.sourceLabel === "string"
    ? input.sourceLabel.trim().slice(0, SAVED_DAY_TITLE_MAX) || null
    : null;

  try {
    const { rows: live, migrated } = await loadLiveTemplateTitles(supabase);
    const conflict = findSavedDayConflict(checked.title, live);
    let title = checked.title;
    let replaceId: string | null = null;
    if (conflict && input.replaceId && conflict.id === input.replaceId) {
      if (!migrated) return fail(lang, "sd.needsMigration");
      replaceId = conflict.id;
    } else if (conflict) {
      title = nextCopyName(checked.title, live.map((r) => r.title), SAVED_DAY_TITLE_MAX);
    }

    const { data, error } = await supabase.rpc("save_day_template", {
      p_id: null, p_title: title, p_exercises: checked.exercises,
      p_source_label: sourceLabel, p_replace_id: replaceId,
    });
    let templateId: string | null = isProgramId(data) ? data : null;
    let failure: unknown = error;
    if (missingSavedDayFunction(error, "save_day_template")) {
      if (replaceId) return fail(lang, "sd.needsMigration");
      const legacy = await legacySave(supabase, null, title, checked.exercises);
      templateId = legacy.id;
      failure = legacy.error;
    }
    if (failure || !templateId) {
      // P0002 here: the saved day being replaced was deleted meanwhile.
      if (!isNotFound(failure)) console.error("Day could not be saved as a template", failure);
      return fail(lang, isNotFound(failure) ? "sd.notFound" : "sd.saveError");
    }
    const linked = input.link ? await linkProgramDay(supabase, input.link, templateId) : false;
    revalidateSavedDays();
    return { ok: true, templateId, title, replacedId: replaceId, linked };
  } catch (error) {
    console.error("Day could not be saved as a template", error);
    return fail(lang, "sd.saveError");
  }
}

/**
 * Undo of "Save day as template": removes the new saved day and, if it
 * replaced one, restores that one — atomically via revert_day_template_save.
 * With `link`, the programme day gets its previous saved day back afterwards.
 */
export async function undoSaveDayAsTemplate(input: {
  templateId: string;
  restoreId: string | null;
  link?: (ProgramDayLink & { previousTemplateId: string | null }) | null;
}): Promise<Result> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  const restoreId = input.restoreId ?? null;
  if (!isProgramId(input.templateId) || (restoreId !== null && !isProgramId(restoreId))) {
    return fail(lang, "sd.undoError");
  }
  try {
    const { error } = await supabase.rpc("revert_day_template_save", {
      p_created_id: input.templateId, p_restore_id: restoreId,
    });
    let failure: unknown = error;
    if (missingSavedDayFunction(error, "revert_day_template_save")) {
      if (restoreId) return fail(lang, "sd.needsMigration");
      const { error: delErr } = await supabase.from("day_templates").delete().eq("id", input.templateId);
      failure = delErr;
    }
    if (failure) {
      if (!isNotFound(failure)) console.error("Saved day could not be undone", failure);
      return fail(lang, "sd.undoError");
    }
    if (input.link) await restoreProgramDayLink(supabase, input.link);
    revalidateSavedDays(input.templateId);
    return { ok: true };
  } catch (error) {
    console.error("Saved day could not be undone", error);
    return fail(lang, "sd.undoError");
  }
}

/**
 * "Update saved day" from a programme day: the saved day keeps its id, name and
 * origin and takes this day's exercises, in one transaction (update_day_template).
 * Its previous version is kept under "Recently deleted" so Undo can restore it;
 * returns that kept row's id. Programmes that used the saved day are not touched.
 */
export async function updateSavedDay(input: {
  id: string;
  exercises: ExerciseInput[];
}): Promise<Result<{ archivedId: string }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(input.id)) return fail(lang, "sd.notFound");
  if (!Array.isArray(input.exercises)) return fail(lang, "sd.emptyDay");
  const exercises = cleanExercises(input.exercises);
  if (exercises.length === 0) return fail(lang, "sd.emptyDay");
  if (exercises.length > MAX_EXERCISES) return fail(lang, "sd.tooManyExercises", { max: MAX_EXERCISES });

  try {
    const { data, error } = await supabase.rpc("update_day_template", {
      p_id: input.id, p_exercises: exercises,
    });
    if (missingSavedDayFunction(error, "update_day_template")) return fail(lang, "sd.needsMigration22");
    if (error || !isProgramId(data)) {
      if (isNotFound(error)) return fail(lang, "sd.notFound");
      console.error("Saved day could not be updated", error);
      return fail(lang, "sd.updateError");
    }
    revalidateSavedDays(input.id);
    return { ok: true, archivedId: data };
  } catch (error) {
    console.error("Saved day could not be updated", error);
    return fail(lang, "sd.updateError");
  }
}

/**
 * Undo of "Update saved day": the kept version's exercises go back on the saved
 * day and its kept row leaves "Recently deleted" (revert_day_template_update).
 */
export async function undoUpdateSavedDay(input: {
  id: string;
  archivedId: string;
}): Promise<Result> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(input.id) || !isProgramId(input.archivedId)) return fail(lang, "sd.undoError");
  try {
    const { error } = await supabase.rpc("revert_day_template_update", {
      p_id: input.id, p_archive_id: input.archivedId,
    });
    if (missingSavedDayFunction(error, "revert_day_template_update")) return fail(lang, "sd.needsMigration22");
    if (error) {
      if (!isNotFound(error)) console.error("Saved day update could not be undone", error);
      return fail(lang, "sd.undoError");
    }
    revalidateSavedDays(input.id);
    return { ok: true };
  } catch (error) {
    console.error("Saved day update could not be undone", error);
    return fail(lang, "sd.undoError");
  }
}

/**
 * Soft delete: the saved day moves to "Recently deleted" (restorable for 30
 * days, then purged). Never a hard delete.
 */
export async function deleteSavedDay(input: { id: string }): Promise<Result> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(input.id)) return fail(lang, "sd.notFound");
  try {
    const { data, error } = await supabase.from("day_templates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id).is("deleted_at", null)
      .select("id").maybeSingle();
    if (error) {
      if (missingSavedDayColumn(error)) return fail(lang, "sd.needsMigration");
      console.error("Saved day could not be deleted", error);
      return fail(lang, "sd.deleteError");
    }
    if (!data) return fail(lang, "sd.notFound");
    revalidateSavedDays(input.id);
    return { ok: true };
  } catch (error) {
    console.error("Saved day could not be deleted", error);
    return fail(lang, "sd.deleteError");
  }
}

/**
 * Brings a saved day back from "Recently deleted". If a live saved day has
 * taken its name meanwhile, it comes back under the next copy name so names
 * stay unique. Returns the name it was restored as.
 */
export async function restoreSavedDay(input: { id: string }): Promise<Result<{ title: string }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(input.id)) return fail(lang, "sd.notFound");
  try {
    const { data: row, error: readError } = await supabase.from("day_templates")
      .select("id, title").eq("id", input.id).not("deleted_at", "is", null)
      .maybeSingle<{ id: string; title: string }>();
    if (readError) {
      if (missingSavedDayColumn(readError)) return fail(lang, "sd.needsMigration");
      console.error("Saved day could not be restored", readError);
      return fail(lang, "sd.restoreError");
    }
    if (!row) return fail(lang, "sd.notFound");

    const { rows: live } = await loadLiveTemplateTitles(supabase);
    const title = findSavedDayConflict(row.title, live)
      ? nextCopyName(row.title, live.map((r) => r.title), SAVED_DAY_TITLE_MAX)
      : row.title;
    const { data, error } = await supabase.from("day_templates")
      .update(title === row.title ? { deleted_at: null } : { deleted_at: null, title })
      .eq("id", input.id).not("deleted_at", "is", null)
      .select("id").maybeSingle();
    if (error) {
      console.error("Saved day could not be restored", error);
      return fail(lang, "sd.restoreError");
    }
    if (!data) return fail(lang, "sd.notFound");
    revalidateSavedDays(input.id);
    return { ok: true, title };
  } catch (error) {
    console.error("Saved day could not be restored", error);
    return fail(lang, "sd.restoreError");
  }
}

/** Renames a live saved day (non-blank, ≤ 300 characters, not taken). */
export async function renameSavedDay(input: { id: string; title: string }): Promise<Result<{ title: string }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(input.id)) return fail(lang, "sd.notFound");
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/gu, " ") : "";
  if (!title) return fail(lang, "sd.nameRequired");
  if (title.length > SAVED_DAY_TITLE_MAX) return fail(lang, "sd.nameTooLong", { max: SAVED_DAY_TITLE_MAX });
  try {
    const { rows: live, migrated } = await loadLiveTemplateTitles(supabase);
    // Same rule as saveTemplate: only a real name change must be free, so a
    // legacy duplicate can still change its spelling / capitalisation.
    if (findSavedDayNameChangeConflict(title, live, input.id)) {
      return fail(lang, "sd.nameTaken", { name: title });
    }
    let query = supabase.from("day_templates").update({ title }).eq("id", input.id);
    if (migrated) query = query.is("deleted_at", null);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) {
      console.error("Saved day could not be renamed", error);
      return fail(lang, "sd.renameError");
    }
    if (!data) return fail(lang, "sd.notFound");
    revalidateSavedDays(input.id);
    return { ok: true, title };
  } catch (error) {
    console.error("Saved day could not be renamed", error);
    return fail(lang, "sd.renameError");
  }
}
