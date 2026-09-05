import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CategoryWithCount,
  ExerciseCategory,
  ExerciseLibrary,
  LibraryExercise,
} from "@/lib/types";

/** Categories are table-driven and sorted by their stored names. */
export function sortCategories<T extends ExerciseCategory>(cats: T[]): T[] {
  return [...cats].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load the whole library for the staff UI: every library exercise tagged with
 * its category ids, plus every category with how many exercises it holds.
 * Runs on the caller's (staff) session — RLS allows staff full access and any
 * authenticated user to read categories.
 */
export async function loadLibrary(supabase: SupabaseClient): Promise<{
  exercises: LibraryExercise[];
  categories: CategoryWithCount[];
}> {
  const [{ data: exRows }, { data: catRows }, { data: mapRows }] =
    await Promise.all([
      supabase
        .from("exercise_library")
        .select("id, name, youtube_url, default_instructions, created_at")
        .order("name", { ascending: true })
        .returns<ExerciseLibrary[]>(),
      supabase
        .from("exercise_categories")
        .select("id, name, is_default, created_at")
        .returns<ExerciseCategory[]>(),
      supabase
        .from("exercise_category_map")
        .select("exercise_id, category_id")
        .returns<{ exercise_id: string; category_id: string }[]>(),
    ]);

  const byExercise = new Map<string, string[]>();
  const countByCat = new Map<string, number>();
  for (const m of mapRows ?? []) {
    const arr = byExercise.get(m.exercise_id) ?? [];
    arr.push(m.category_id);
    byExercise.set(m.exercise_id, arr);
    countByCat.set(m.category_id, (countByCat.get(m.category_id) ?? 0) + 1);
  }

  const exercises: LibraryExercise[] = (exRows ?? []).map((e) => ({
    ...e,
    category_ids: byExercise.get(e.id) ?? [],
  }));

  const categories: CategoryWithCount[] = sortCategories(catRows ?? []).map(
    (c) => ({ ...c, count: countByCat.get(c.id) ?? 0 }),
  );

  return { exercises, categories };
}
