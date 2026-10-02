import type { EditorDay, EditorExercise } from "@/lib/program-editor-model";
import {
  fromDayDraft,
  fromExerciseDraft,
  newDraftKey,
  toDayDraft,
  type DayDraft,
  type ExerciseDraft,
} from "./drafts";

/**
 * Pure day operations for the shared programme / saved-day editor. Every
 * function returns NEW arrays (never mutates its input) so React state updates
 * stay predictable and the tests can exercise them without a DOM.
 */

/** A fresh, empty training day (no title, no exercises). */
export function emptyDay(): DayDraft {
  return { key: newDraftKey("day"), title: "", sourceTemplateLabel: null, exercises: [] };
}

/** Editor state from loaded days — always at least one day to work on. */
export function initialDays(days: readonly EditorDay[]): DayDraft[] {
  return days.length ? days.map(toDayDraft) : [emptyDay()];
}

/**
 * Normalise whatever the page loader returns into `EditorDay[]`: picks only the
 * editor fields (DB rows carry ids / order / day_id) and defaults the origin
 * label for loaders that do not know about it yet.
 */
export function asEditorDays(
  days: readonly {
    title: string | null;
    sourceTemplateLabel?: string | null;
    exercises: readonly EditorExercise[];
  }[],
): EditorDay[] {
  return days.map((d) => ({
    title: d.title ?? "",
    sourceTemplateLabel: d.sourceTemplateLabel ?? null,
    exercises: d.exercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      instructions: e.instructions,
      media_url: e.media_url,
      library_id: e.library_id,
    })),
  }));
}

const isNamed = (e: { name: string }) => e.name.trim() !== "";

/** Exercises that have a name (what a save keeps). */
export function namedExercises<T extends { name: string }>(exercises: readonly T[]): T[] {
  return exercises.filter(isNamed);
}

export function hasNamedExercises(day: Pick<DayDraft, "exercises">): boolean {
  return day.exercises.some(isNamed);
}

/**
 * The first row (in day order) whose name is blank, or null. A save would
 * silently drop such a row (and the cues typed into it), so the editor blocks
 * the save and points at it instead.
 */
export function firstUnnamedExercise(
  days: readonly Pick<DayDraft, "exercises">[],
): { dayIndex: number; exerciseIndex: number } | null {
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const exerciseIndex = days[dayIndex].exercises.findIndex((e) => !isNamed(e));
    if (exerciseIndex !== -1) return { dayIndex, exerciseIndex };
  }
  return null;
}

/** Titles are one logical line: pasted / typed line breaks become spaces. */
export function singleLine(value: string): string {
  return value.replace(/\r\n|[\r\n]/g, " ");
}

/** Where a caret at `caret` in `value` sits in `singleLine(value)` ("\r\n" → one space). */
export function singleLineCaret(value: string, caret: number): number {
  return singleLine(value.slice(0, Math.max(0, Math.min(caret, value.length)))).length;
}

/**
 * The `?day=N` search param (1-based, as shown in the rail) → a 0-based day
 * index. Anything missing or malformed means the first day; the editor clamps
 * an index past the last day back to the first day too.
 */
export function dayIndexFromParam(param: string | string[] | undefined): number {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw || !/^\d{1,4}$/.test(raw)) return 0;
  return Math.max(0, Number(raw) - 1);
}

/** Whether `saveProgram` keeps a day (it drops days with no title and no named exercise). */
export function daySurvivesSave(day: Pick<DayDraft, "title" | "exercises">): boolean {
  return day.title.trim() !== "" || hasNamedExercises(day);
}

/**
 * The 0-based index the selected day will have AFTER a save (blank days before
 * it are dropped), for the `?day=N` of the first save's edit URL. A blank
 * selected day itself falls back to the kept day just before it (or the first).
 */
export function savedDayIndex(
  days: readonly Pick<DayDraft, "title" | "exercises">[],
  selectedIndex: number,
): number {
  const keptBefore = days.slice(0, selectedIndex).filter(daySurvivesSave).length;
  const selected = days[selectedIndex];
  if (selected && daySurvivesSave(selected)) return keptBefore;
  return Math.max(0, keptBefore - 1);
}

/**
 * The dirty-check snapshot: everything that gets saved, WITHOUT the React keys
 * (so re-keying, e.g. after a reload, never counts as a change).
 */
export function editorSnapshot(state: {
  title: string;
  monthStartDate: string;
  notes: string;
  days: readonly DayDraft[];
}): string {
  return JSON.stringify({
    title: state.title,
    month: state.monthStartDate,
    notes: state.notes,
    days: state.days.map((d) => ({
      title: d.title,
      sourceTemplateLabel: d.sourceTemplateLabel,
      exercises: d.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        instructions: e.instructions,
        media_url: e.media_url,
        library_id: e.library_id,
        saveToLibrary: e.saveToLibrary,
      })),
    })),
  });
}

/** Days as `saveProgram` takes them: origin label kept, unnamed rows dropped. */
export function toSaveDays(days: readonly DayDraft[]) {
  return days.map((d) => {
    const day = fromDayDraft(d);
    return {
      title: day.title,
      sourceTemplateLabel: day.sourceTemplateLabel,
      exercises: namedExercises(d.exercises).map(fromExerciseDraft),
    };
  });
}

/** One day's exercises as `saveTemplate` takes them (unnamed rows dropped). */
export function toSaveExercises(exercises: readonly ExerciseDraft[]) {
  return namedExercises(exercises).map(fromExerciseDraft);
}

/** Append a day at the END (existing days untouched). Returns the new key. */
export function appendDay(
  days: readonly DayDraft[],
  day: DayDraft = emptyDay(),
): { days: DayDraft[]; key: string } {
  return { days: [...days, day], key: day.key };
}

/**
 * Insert a saved day as a NEW last day (deep copy via toDayDraft — fresh keys,
 * fresh exercise objects). Existing days are returned untouched.
 */
export function insertDayAtEnd(
  days: readonly DayDraft[],
  day: EditorDay,
): { days: DayDraft[]; key: string } {
  return appendDay(days, toDayDraft(day));
}

/**
 * Remove exactly one day by key. Never leaves zero days (an empty day takes
 * the last one's place). `selectedKey` is the neighbour to show next.
 */
export function removeDay(
  days: readonly DayDraft[],
  key: string,
): { days: DayDraft[]; selectedKey: string } {
  const index = days.findIndex((d) => d.key === key);
  if (index === -1) return { days: [...days], selectedKey: days[0]?.key ?? "" };
  const next = days.filter((d) => d.key !== key);
  if (!next.length) {
    const blank = emptyDay();
    return { days: [blank], selectedKey: blank.key };
  }
  return { days: next, selectedKey: next[Math.min(index, next.length - 1)].key };
}

/** A deep copy of a day with fresh keys, placed right after the original. */
export function duplicateDay(
  days: readonly DayDraft[],
  key: string,
): { days: DayDraft[]; key: string | null } {
  const index = days.findIndex((d) => d.key === key);
  if (index === -1) return { days: [...days], key: null };
  const source = days[index];
  const copy: DayDraft = {
    key: newDraftKey("day"),
    title: source.title,
    sourceTemplateLabel: source.sourceTemplateLabel,
    exercises: source.exercises.map((e) => ({ ...e, key: newDraftKey("ex") })),
  };
  return {
    days: [...days.slice(0, index + 1), copy, ...days.slice(index + 1)],
    key: copy.key,
  };
}

/** Swap a day with its neighbour (-1 = earlier, 1 = later). No-op at the ends. */
export function moveDay(days: readonly DayDraft[], key: string, dir: -1 | 1): DayDraft[] {
  const index = days.findIndex((d) => d.key === key);
  const target = index + dir;
  if (index === -1 || target < 0 || target >= days.length) return [...days];
  const next = [...days];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Replace one day's fields (title, exercises…) by key. */
export function patchDay(
  days: readonly DayDraft[],
  key: string,
  patch: Partial<Omit<DayDraft, "key">>,
): DayDraft[] {
  return days.map((d) => (d.key === key ? { ...d, ...patch } : d));
}

/** Export rows for the PDF: titles kept, unnamed rows and blank days dropped. */
export function toExportDays(days: readonly DayDraft[]) {
  return days
    .map((d) => ({
      title: d.title.trim(),
      exercises: namedExercises(d.exercises).map((e) => ({
        name: e.name.trim(),
        sets: e.sets,
        reps: e.reps,
        instructions: e.instructions,
        media_url: e.media_url,
        library_id: e.library_id,
      })),
    }))
    .filter((d) => d.title || d.exercises.length);
}
