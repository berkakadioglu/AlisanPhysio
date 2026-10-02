import { formatMonth, setsEffort, t, type Lang } from "@/lib/i18n";
import type { Exercise, ProgramDay } from "@/lib/types";

export type ExerciseWithVideo = Exercise & {
  exercise_library: { youtube_url: string | null } | null;
};
export type TrainingDay = { id: string; title: string; exercises: ExerciseWithVideo[] };

export function trainingDays(days: ProgramDay[], exercises: ExerciseWithVideo[], lang: Lang): TrainingDay[] {
  const byOrder = (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index;
  const sections = [...days].sort(byOrder).map((day, index) => ({
    id: day.id,
    title: day.title?.trim() || t(lang, "prog.day", { n: index + 1 }),
    exercises: exercises.filter((exercise) => exercise.day_id === day.id).sort(byOrder),
  }));
  const orphans = exercises.filter((exercise) => !days.some((day) => day.id === exercise.day_id)).sort(byOrder);
  if (orphans.length) sections.push({ id: "ungrouped", title: t(lang, "prog.day", { n: sections.length + 1 }), exercises: orphans });
  return sections;
}

export function exerciseEffort(exercise: Exercise, lang: Lang): string | null {
  const reps = exercise.reps?.trim();
  if (exercise.sets != null && reps) return `${exercise.sets} × ${reps}`;
  if (exercise.sets != null) return setsEffort(lang, exercise.sets);
  return reps || null;
}

/** Month-only titles may have been authored in either supported language. */
export function titleIsMonth(title: string, month: string): boolean {
  const normalize = (value: string, lang: Lang) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase(lang);
  return (["en", "tr"] as const).some((lang) => normalize(title, lang) === normalize(formatMonth(month, lang), lang));
}
