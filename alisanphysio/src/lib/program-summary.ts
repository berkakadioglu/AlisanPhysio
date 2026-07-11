/**
 * Shared, language-aware helpers for summarizing a program's structure
 * (days + exercises). Used by the program cards and the "copy from previous"
 * modal so they read consistently.
 */
import { daysCount, exercisesCount, type Lang } from "@/lib/i18n";

/** Just the day part: titled names ("Chest Day · Leg Day"), "N days", or "". */
export function dayLabel(dayTitles: string[], lang: Lang): string {
  const titled = dayTitles.filter((t) => t.trim() !== "");
  if (titled.length > 0) return titled.join(" · ");
  if (dayTitles.length > 1) return daysCount(lang, dayTitles.length);
  return "";
}

/** The count part: "N days · M exercises" or just "M exercises". */
export function countLabel(
  dayTitles: string[],
  exerciseCount: number,
  lang: Lang,
): string {
  const exercises = exercisesCount(lang, exerciseCount);
  if (dayTitles.length > 1) {
    return `${daysCount(lang, dayTitles.length)} · ${exercises}`;
  }
  return exercises;
}

/** Full one-line summary, e.g. "Chest Day · Leg Day · 8 exercises". */
export function structureSummary(
  dayTitles: string[],
  exerciseCount: number,
  lang: Lang,
): string {
  const days = dayLabel(dayTitles, lang);
  const exercises = exercisesCount(lang, exerciseCount);
  return days ? `${days} · ${exercises}` : exercises;
}
