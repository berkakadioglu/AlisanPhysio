import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import type { Exercise, ExerciseLibrary, Program, ProgramDay } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor, {
  type EditorDay,
  type EditorInitial,
} from "@/app/admin/program-editor";

export const metadata: Metadata = {
  title: `Edit program · ${BRAND_NAME}`,
};

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string; programId: string }>;
}) {
  const { id, programId } = await params;
  const { supabase } = await requireStaff();

  const { data: program } = await supabase
    .from("programs")
    .select("id, client_id, title, week_start_date, notes, created_at")
    .eq("id", programId)
    .maybeSingle<Program>();

  if (!program || program.client_id !== id) {
    notFound();
  }

  const [
    { data: exercises },
    { data: dayRows },
    { data: library },
    { data: usedRows },
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, program_id, name, sets, reps, instructions, media_url, order_index, library_id, day_id")
      .eq("program_id", programId)
      .order("order_index", { ascending: true })
      .returns<Exercise[]>(),
    supabase
      .from("program_days")
      .select("id, program_id, title, order_index, created_at")
      .eq("program_id", programId)
      .order("order_index", { ascending: true })
      .returns<ProgramDay[]>(),
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

  const allExercises = exercises ?? [];
  const toEditor = (e: Exercise) => ({
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    instructions: e.instructions,
    media_url: e.media_url,
    library_id: e.library_id,
  });

  let days: EditorDay[];
  if (dayRows && dayRows.length > 0) {
    days = dayRows.map((d) => ({
      title: d.title ?? "",
      exercises: allExercises.filter((e) => e.day_id === d.id).map(toEditor),
    }));
  } else {
    days = [{ title: "", exercises: allExercises.map(toEditor) }];
  }

  const initial: EditorInitial = {
    title: program.title,
    weekStartDate: program.week_start_date,
    notes: program.notes ?? "",
    days,
  };

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <ProgramEditor
          clientId={id}
          programId={programId}
          initial={initial}
          library={library ?? []}
          usedWeeks={usedWeeks}
        />
      </main>
    </div>
  );
}
