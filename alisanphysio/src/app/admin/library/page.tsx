import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import type { ExerciseLibrary } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import LibraryManager from "./library-manager";

export const metadata: Metadata = {
  title: `Exercise library · ${BRAND_NAME}`,
};

export default async function LibraryPage() {
  const { supabase } = await requireAdmin();

  const { data: items } = await supabase
    .from("exercise_library")
    .select("id, name, youtube_url, default_instructions, created_at")
    .order("name", { ascending: true })
    .returns<ExerciseLibrary[]>();

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <LibraryManager items={items ?? []} />
      </main>
    </div>
  );
}
