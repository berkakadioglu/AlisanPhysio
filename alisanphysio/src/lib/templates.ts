import type { SupabaseClient } from "@supabase/supabase-js";
import { isProgramId } from "@/lib/catalog-programs";
import { missingCatalogColumn, type CatalogDatabaseError } from "@/lib/catalog-compatibility";
import { savedDayPurgeCutoff } from "@/lib/saved-days";
import type {
  DayTemplate,
  DayTemplateExercise,
  TemplateSummary,
  TemplateWithExercises,
} from "@/lib/types";

/**
 * Saved days ("day templates") loaders. Every list of saved days shows LIVE
 * rows only (deleted_at is null) — except the tab's "Recently deleted" group.
 *
 * Compatibility: the app may run before migration 0021 adds deleted_at,
 * source_label and updated_at. When a query fails because one of those
 * columns is missing, the loaders fall back to the legacy columns and treat
 * every row as live (updated_at = created_at, no source label).
 */

const SAVED_DAY_COLS = "id, title, created_at, updated_at, deleted_at, source_label";
const LEGACY_COLS = "id, title, created_at";
const EXERCISE_COLS =
  "id, template_id, name, library_id, sets, reps, instructions, media_url, order_index";
const NEW_COLUMNS = ["deleted_at", "updated_at", "source_label"] as const;
const PAGE = 1000;

/** A query failed only because 0021's columns are not there yet. */
export function missingSavedDayColumn(error: CatalogDatabaseError | null): boolean {
  return NEW_COLUMNS.some((column) => missingCatalogColumn(error, column));
}

/** An RPC failed only because the function does not exist yet (before 0021). */
export function missingSavedDayFunction(
  error: CatalogDatabaseError | null,
  name: "save_day_template" | "revert_day_template_save",
): boolean {
  return !!error && (error.code === "PGRST202" || error.code === "42883")
    && (error.message ?? "").includes(name);
}

type Row = {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  source_label?: string | null;
  day_template_exercises?: unknown;
};

function toDayTemplate(row: Row): DayTemplate {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    deleted_at: row.deleted_at ?? null,
    source_label: row.source_label ?? null,
  };
}

function exerciseCount(row: Row): number {
  const embedded = row.day_template_exercises;
  return Array.isArray(embedded) ? Number(embedded[0]?.count ?? 0) : 0;
}

function orderedExercises(row: Row): DayTemplateExercise[] {
  const embedded = Array.isArray(row.day_template_exercises)
    ? (row.day_template_exercises as DayTemplateExercise[])
    : [];
  return [...embedded].sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
}

type Query = {
  status: "live" | "deleted";
  /** Embedded child select, e.g. "day_template_exercises(count)". */
  embed?: string;
  id?: string;
  orderBy: "title" | "recent";
};

/**
 * Pages through day_templates (PostgREST caps a response at 1000 rows).
 * `migrated` is false when the legacy fallback was used.
 */
async function queryTemplates(
  supabase: SupabaseClient,
  { status, embed, id, orderBy }: Query,
): Promise<{ rows: Row[]; migrated: boolean }> {
  async function run(modern: boolean) {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from("day_templates")
        .select(`${modern ? SAVED_DAY_COLS : LEGACY_COLS}${embed ? `, ${embed}` : ""}`);
      if (id) query = query.eq("id", id);
      if (modern) {
        query = status === "live"
          ? query.is("deleted_at", null)
          : query.not("deleted_at", "is", null);
      }
      const column = orderBy === "title"
        ? "title"
        : !modern ? "created_at" : status === "deleted" ? "deleted_at" : "updated_at";
      const { data, error } = await query
        .order(column, { ascending: orderBy === "title" })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1)
        .returns<Row[]>();
      if (error) return { rows, error };
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) return { rows, error: null };
    }
  }

  const modern = await run(true);
  if (!modern.error) return { rows: modern.rows, migrated: true };
  if (!missingSavedDayColumn(modern.error)) {
    throw new Error(`Could not load saved days: ${modern.error.message}`);
  }
  // Before 0021 nothing can be deleted, so "Recently deleted" is empty.
  if (status === "deleted") return { rows: [], migrated: false };
  const legacy = await run(false);
  if (legacy.error) throw new Error(`Could not load saved days: ${legacy.error.message}`);
  return { rows: legacy.rows, migrated: false };
}

/**
 * The Saved days tab: live saved days (most recently updated first) and the
 * "Recently deleted" group (most recently deleted first), with exercise counts.
 */
export async function loadSavedDays(supabase: SupabaseClient): Promise<{
  live: TemplateSummary[];
  deleted: TemplateSummary[];
  migrated: boolean;
}> {
  const embed = "day_template_exercises(count)";
  const [live, deleted] = await Promise.all([
    queryTemplates(supabase, { status: "live", embed, orderBy: "recent" }),
    queryTemplates(supabase, { status: "deleted", embed, orderBy: "recent" }),
  ]);
  const summary = (row: Row): TemplateSummary => ({ ...toDayTemplate(row), count: exerciseCount(row) });
  return {
    live: live.rows.map(summary),
    deleted: deleted.rows.map(summary),
    migrated: live.migrated && deleted.migrated,
  };
}

/** Live saved days (title + exercise count), most recently updated first. */
export async function loadTemplateSummaries(
  supabase: SupabaseClient,
): Promise<TemplateSummary[]> {
  return (await loadSavedDays(supabase)).live;
}

/** A single LIVE saved day with its ordered exercises (saved-day editor). */
export async function loadTemplate(
  supabase: SupabaseClient,
  id: string,
): Promise<TemplateWithExercises | null> {
  if (!isProgramId(id)) return null;
  const { rows } = await queryTemplates(supabase, {
    status: "live",
    embed: `day_template_exercises(${EXERCISE_COLS})`,
    id,
    orderBy: "title",
  });
  const row = rows[0];
  return row ? { ...toDayTemplate(row), exercises: orderedExercises(row) } : null;
}

/**
 * Every LIVE saved day with its ordered exercises, sorted by title — for the
 * editor's "Insert saved day" dialog and the save dialog's name check. Saved
 * days are a small, staff-curated set, so loading them all is cheap. A failure
 * here must not take the whole editor down: it is logged, the list is empty
 * and `savedDaysFailed` is true, so the editor can say "couldn't be loaded"
 * (InsertSavedDayDialog's `loadFailed`) instead of "no saved days yet".
 */
export async function loadSavedDaysForEditor(
  supabase: SupabaseClient,
): Promise<{ savedDays: TemplateWithExercises[]; savedDaysFailed: boolean }> {
  try {
    const { rows } = await queryTemplates(supabase, {
      status: "live",
      embed: `day_template_exercises(${EXERCISE_COLS})`,
      orderBy: "title",
    });
    return {
      savedDays: rows.map((row) => ({ ...toDayTemplate(row), exercises: orderedExercises(row) })),
      savedDaysFailed: false,
    };
  } catch (error) {
    console.error("Saved days could not be loaded for the editor", error);
    return { savedDays: [], savedDaysFailed: true };
  }
}

/**
 * The live saved days only (empty on failure) — prefer
 * `loadSavedDaysForEditor`, which also reports a failed load.
 */
export async function loadTemplatesForPicker(
  supabase: SupabaseClient,
): Promise<TemplateWithExercises[]> {
  return (await loadSavedDaysForEditor(supabase)).savedDays;
}

/**
 * Live saved-day names, for the server-side name-conflict check. `migrated`
 * is false before 0021 (then every row counts as live).
 */
export async function loadLiveTemplateTitles(
  supabase: SupabaseClient,
): Promise<{ rows: Pick<DayTemplate, "id" | "title" | "deleted_at">[]; migrated: boolean }> {
  const { rows, migrated } = await queryTemplates(supabase, { status: "live", orderBy: "title" });
  return { rows: rows.map((r) => ({ id: r.id, title: r.title, deleted_at: null })), migrated };
}

/**
 * Removes saved days that have been in "Recently deleted" for the retention
 * period (30 days). Runs lazily when staff open the Saved days tab; a failure
 * is logged and ignored so the tab still loads. A no-op before 0021.
 */
export async function purgeExpiredSavedDays(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<void> {
  try {
    const { error } = await supabase
      .from("day_templates")
      .delete()
      .lte("deleted_at", savedDayPurgeCutoff(now).toISOString());
    if (error && !missingSavedDayColumn(error)) {
      console.error("Expired saved days could not be purged", error);
    }
  } catch (error) {
    console.error("Expired saved days could not be purged", error);
  }
}
