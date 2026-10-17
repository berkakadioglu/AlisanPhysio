/**
 * Saved days ("day templates") — pure helpers shared by the editor dialogs,
 * the server actions and the tests.
 *
 * Copy semantics: saving a day and inserting a saved day are ALWAYS copies,
 * never links. Every function here returns fresh objects, so editing a
 * programme day never changes the saved day it came from and vice versa.
 */
import type { EditorDay, EditorExercise } from "@/lib/program-editor-model";
import type { DayTemplate, TemplateWithExercises } from "@/lib/types";
import { type Lang } from "@/lib/i18n";

/** Deleted saved days stay restorable for this many days, then are purged. */
export const SAVED_DAY_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Case-insensitive, whitespace-collapsed name key. "İ" folds to "i" (and "I"
 * to "i") so "İtme günü" and "itme Günü" match whatever keyboard typed them.
 */
export function savedDayNameKey(name: string): string {
  return name
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US")
    .normalize("NFD")
    .replace(/̇/gu, "")
    .normalize("NFC");
}

/** The live (not deleted) saved day with the same name, if any. */
export function findSavedDayConflict<T extends Pick<DayTemplate, "id" | "title" | "deleted_at">>(
  name: string,
  savedDays: readonly T[],
  exceptId?: string | null,
): T | null {
  const key = savedDayNameKey(name);
  if (!key) return null;
  return (
    savedDays.find(
      (d) => !d.deleted_at && d.id !== exceptId && savedDayNameKey(d.title) === key,
    ) ?? null
  );
}

/**
 * The live saved day that blocks giving saved day `id` (or a NEW saved day,
 * when `id` is empty) the name `name`. Unlike `findSavedDayConflict`, keeping
 * the row's current name (in any spelling / capitalisation) is never blocked,
 * so a legacy duplicate from the old template editor can still be saved
 * without being renamed first. Only a new row or a real name change must be free.
 */
export function findSavedDayNameChangeConflict<T extends Pick<DayTemplate, "id" | "title" | "deleted_at">>(
  name: string,
  savedDays: readonly T[],
  id?: string | null,
): T | null {
  const own = id ? savedDays.find((d) => d.id === id && !d.deleted_at) : undefined;
  if (own && savedDayNameKey(own.title) === savedDayNameKey(name)) return null;
  return findSavedDayConflict(name, savedDays, id);
}

/** The Save day dialog's same-name choice and the saved day it was made for. */
export type SaveDayChoice = { mode: "copy" | "replace"; forId: string | null };

/**
 * The choice that applies to the current conflict. "Replace" only counts for
 * the saved day it was picked for: when the name starts matching another saved
 * day (or none), the choice starts again from "Save as a new copy" — the
 * default for every conflict. Returns `choice` itself when it still applies.
 */
export function saveDayChoiceFor(choice: SaveDayChoice, conflictId: string | null | undefined): SaveDayChoice {
  const forId = conflictId ?? null;
  return choice.forId === forId ? choice : { mode: "copy", forId };
}

/** "Name (2)" → "Name": the base a new copy number is added to. */
export function copyNameBase(name: string): string {
  return name.trim().replace(/\s+/gu, " ").replace(/\s*\(\d+\)$/u, "") || name.trim();
}

/**
 * The first free copy name: "Push Day" → "Push Day (2)", then "(3)", …
 * Saving a copy of "Push Day (2)" continues the sequence instead of nesting
 * ("Push Day (3)", never "Push Day (2) (2)"). With `maxLength`, the base is
 * shortened so the whole name still fits (the database caps titles at 300).
 */
export function nextCopyName(
  name: string,
  takenTitles: readonly string[],
  maxLength = Number.POSITIVE_INFINITY,
): string {
  const base = copyNameBase(name);
  const taken = new Set(takenTitles.map(savedDayNameKey));
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const room = maxLength - suffix.length;
    const candidate = `${base.length > room ? base.slice(0, Math.max(0, room)).trimEnd() : base}${suffix}`;
    if (!taken.has(savedDayNameKey(candidate))) return candidate;
  }
}

/** Saved-day names are capped like programme titles (save_day_template). */
export const SAVED_DAY_TITLE_MAX = 300;

function copyExercise(e: EditorExercise): EditorExercise {
  return {
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    instructions: e.instructions,
    media_url: e.media_url,
    library_id: e.library_id,
  };
}

/** Named exercises only — what a save would keep. Deep-copied. */
export function savableExercises(exercises: readonly EditorExercise[]): EditorExercise[] {
  return exercises
    .filter((e) => e.name.trim() !== "")
    .map((e) => ({ ...copyExercise(e), name: e.name.trim() }));
}

/**
 * A saved day → a NEW editor day (deep copy; the origin and the saved day's id
 * are recorded, the id only for "Update saved day").
 */
export function savedDayToEditorDay(tpl: TemplateWithExercises): EditorDay {
  return {
    title: tpl.title,
    sourceTemplateLabel: tpl.title,
    sourceTemplateId: tpl.id,
    exercises: [...tpl.exercises]
      .sort((a, b) => a.order_index - b.order_index)
      .map((e) =>
        copyExercise({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          instructions: e.instructions,
          media_url: e.media_url,
          library_id: e.library_id,
        }),
      ),
  };
}

/** An editor day → the exercises a saved day stores (deep copy). */
export function editorDayToSavedExercises(day: EditorDay): EditorExercise[] {
  return savableExercises(day.exercises);
}

/** The fields "Update saved day" can report as changed for one exercise. */
export type SavedDayChangeField = "name" | "dose" | "cues" | "video" | "link";

/** What "Update saved day" would change in a saved day (see savedDayDiff). */
export interface SavedDayDiff {
  /** Names of the exercises the update adds, in day order. */
  added: string[];
  /** Names of the exercises the update removes, in saved order. */
  removed: string[];
  /** Paired exercises whose content changes, in day order. */
  changed: { name: string; fields: SavedDayChangeField[] }[];
  /** The paired exercises come in a different order than the saved day has. */
  reordered: boolean;
  /** Nothing is added, removed, changed or reordered. */
  same: boolean;
}

/**
 * The difference between a saved day's exercises (`saved`) and the exercises
 * an update would give it (`next`, as the editor holds them). Exercises pair up
 * by name (case-insensitive, like saved-day names); a name that repeats pairs
 * in order. Blank rows are ignored and whitespace-only differences do not count.
 */
export function savedDayDiff(
  saved: readonly {
    name: string;
    sets: number | null;
    reps: string | null;
    instructions: string | null;
    media_url: string | null;
    library_id: string | null;
    order_index: number;
  }[],
  next: readonly EditorExercise[],
): SavedDayDiff {
  const text = (value: string | null) => (value ?? "").trim();
  const old = [...saved].sort((a, b) => a.order_index - b.order_index);
  const nw = savableExercises(next);
  const used = new Set<number>();
  const paired: number[] = []; // the old index each paired new exercise took, in day order
  const added: string[] = [];
  const changed: { name: string; fields: SavedDayChangeField[] }[] = [];

  for (const e of nw) {
    const key = savedDayNameKey(e.name);
    const oldIndex = old.findIndex((o, i) => !used.has(i) && savedDayNameKey(o.name) === key);
    if (oldIndex === -1) {
      added.push(e.name);
      continue;
    }
    used.add(oldIndex);
    paired.push(oldIndex);
    const o = old[oldIndex];
    const fields: SavedDayChangeField[] = [];
    if (o.name.trim() !== e.name.trim()) fields.push("name");
    if ((o.sets ?? null) !== (e.sets ?? null) || text(o.reps) !== text(e.reps)) fields.push("dose");
    if (text(o.instructions) !== text(e.instructions)) fields.push("cues");
    if (text(o.media_url) !== text(e.media_url)) fields.push("video");
    if ((o.library_id ?? null) !== (e.library_id ?? null)) fields.push("link");
    if (fields.length) changed.push({ name: e.name, fields });
  }

  const removed = old.filter((_, i) => !used.has(i)).map((o) => o.name.trim());
  const reordered = paired.some((oldIndex, i) => i > 0 && oldIndex <= paired[i - 1]);
  return {
    added,
    removed,
    changed,
    reordered,
    same: added.length === 0 && removed.length === 0 && changed.length === 0 && !reordered,
  };
}

/** When a deleted saved day is removed for good. */
export function savedDayPurgeDate(deletedAt: string): Date {
  return new Date(new Date(deletedAt).getTime() + SAVED_DAY_RETENTION_DAYS * DAY_MS);
}

export function isSavedDayExpired(deletedAt: string, now: Date): boolean {
  return savedDayPurgeDate(deletedAt).getTime() <= now.getTime();
}

/** Saved days deleted before this instant are due to be removed for good. */
export function savedDayPurgeCutoff(now: Date): Date {
  return new Date(now.getTime() - SAVED_DAY_RETENTION_DAYS * DAY_MS);
}

const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};

/**
 * Where a saved day came from, stored as text: "Test Sevim · Oct 2026" for a
 * client programme, the programme title for a catalogue programme, null when
 * there is nothing useful to say.
 */
export function savedDaySourceLabel(input: {
  clientName?: string | null;
  monthStart?: string | null;
  programTitle?: string | null;
  lang: Lang;
}): string | null {
  const client = input.clientName?.trim();
  const month = /^\d{4}-\d{2}-\d{2}$/.test(input.monthStart ?? "")
    ? (() => {
        const [y, m] = (input.monthStart as string).split("-").map(Number);
        return `${MONTHS_SHORT[input.lang][m - 1]} ${y}`;
      })()
    : null;
  if (client) return month ? `${client} · ${month}` : client;
  const title = input.programTitle?.trim();
  return title ? title.slice(0, 200) : null;
}
