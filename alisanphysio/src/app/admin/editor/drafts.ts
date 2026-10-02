import type { EditorDay, EditorExercise } from "@/lib/program-editor-model";

/**
 * Client-side editing state for the shared programme / saved-day editor.
 * A draft is an EditorExercise plus a stable React key and the "also save to
 * my library" flag for custom exercises. Building a draft always copies, so a
 * day inserted from a saved day never shares objects with it.
 */
export interface ExerciseDraft extends EditorExercise {
  key: string;
  /** Custom (unlinked) exercise the coach wants added to the library on save. */
  saveToLibrary: boolean;
}

export interface DayDraft {
  key: string;
  title: string;
  sourceTemplateLabel: string | null;
  exercises: ExerciseDraft[];
}

let seq = 0;
export const newDraftKey = (prefix = "k") => `${prefix}-${++seq}`;

export function toExerciseDraft(e: EditorExercise): ExerciseDraft {
  return {
    key: newDraftKey("ex"),
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    instructions: e.instructions,
    media_url: e.media_url,
    library_id: e.library_id,
    saveToLibrary: false,
  };
}

export function toDayDraft(d: EditorDay): DayDraft {
  return {
    key: newDraftKey("day"),
    title: d.title,
    sourceTemplateLabel: d.sourceTemplateLabel,
    exercises: d.exercises.map(toExerciseDraft),
  };
}

/** Back to the saved shape (+ the save-to-library flag for unlinked rows). */
export function fromExerciseDraft(d: ExerciseDraft): EditorExercise & { saveToLibrary: boolean } {
  return {
    name: d.name,
    sets: d.sets,
    reps: d.reps,
    instructions: d.instructions,
    media_url: d.media_url,
    library_id: d.library_id,
    saveToLibrary: d.saveToLibrary && !d.library_id,
  };
}

export function fromDayDraft(d: DayDraft): EditorDay {
  return {
    title: d.title,
    sourceTemplateLabel: d.sourceTemplateLabel,
    exercises: d.exercises.map(fromExerciseDraft),
  };
}
