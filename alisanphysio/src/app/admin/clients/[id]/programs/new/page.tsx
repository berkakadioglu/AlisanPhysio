import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import type { ExerciseLibrary, Program, ProgramDay } from "@/lib/types";
import { defaultNewWeek, nextMondayISO, thisMondayISO } from "@/lib/program-dates";
import { weekTitle } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor, {
  type EditorDay,
  type EditorExercise,
  type EditorInitial,
} from "@/app/admin/program-editor";

export const metadata: Metadata = {
  title: `New program · ${BRAND_NAME}`,
};

type SourceExercise = EditorExercise & { day_id: string | null };

export default async function NewProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copyFrom?: string }>;
}) {
  const { id } = await params;
  const { copyFrom } = await searchParams;
  const { supabase } = await requireAdmin();
  const lang = await getLang();

  const [{ data: library }, { data: usedRows }] = await Promise.all([
    supabase
      .from("exercise_library")
      .select("id, name, youtube_url, default_instructions, created_at")
      .order("name", { ascending: true })
      .returns<ExerciseLibrary[]>(),
    supabase
      .from("programs")
      .select("week_start_date")
      .eq("client_id", id)
      .returns<{ week_start_date: string }[]>(),
  ]);
  const usedWeeks = (usedRows ?? []).map((r) => r.week_start_date);

  let initial: EditorInitial;

  if (copyFrom) {
    // "Copy from previous week": duplicate the full structure into next week.
    const { data: source } = await supabase
      .from("programs")
      .select("id, client_id, title, week_start_date, notes")
      .eq("id", copyFrom)
      .eq("client_id", id)
      .maybeSingle<Program>();

    const [{ data: sourceDays }, { data: sourceExercises }] = await Promise.all([
      supabase
        .from("program_days")
        .select("id, program_id, title, order_index, created_at")
        .eq("program_id", copyFrom)
        .order("order_index", { ascending: true })
        .returns<ProgramDay[]>(),
      supabase
        .from("exercises")
        .select("name, sets, reps, instructions, media_url, library_id, day_id, order_index")
        .eq("program_id", copyFrom)
        .order("order_index", { ascending: true })
        .returns<(SourceExercise & { order_index: number })[]>(),
    ]);

    const exercises = sourceExercises ?? [];
    const toEditor = (e: SourceExercise): EditorExercise => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      instructions: e.instructions,
      media_url: e.media_url,
      library_id: e.library_id,
    });

    let editorDays: EditorDay[];
    if (sourceDays && sourceDays.length > 0) {
      editorDays = sourceDays.map((d) => ({
        title: d.title ?? "",
        exercises: exercises.filter((e) => e.day_id === d.id).map(toEditor),
      }));
    } else {
      // No days on the source → keep it flat.
      editorDays = [{ title: "", exercises: exercises.map(toEditor) }];
    }

    const monday = source
      ? nextMondayISO(source.week_start_date)
      : thisMondayISO();

    initial = {
      title: weekTitle(monday, lang),
      weekStartDate: monday,
      notes: source?.notes ?? "",
      days: editorDays,
    };
  } else {
    // Default to the first upcoming week that doesn't already have a program.
    const monday = defaultNewWeek(usedWeeks);
    initial = {
      title: weekTitle(monday, lang),
      weekStartDate: monday,
      notes: "",
      days: [],
    };
  }

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <ProgramEditor
          clientId={id}
          initial={initial}
          library={library ?? []}
          usedWeeks={usedWeeks}
        />
      </main>
    </div>
  );
}
