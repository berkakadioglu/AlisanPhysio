import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { loadLibrary } from "@/lib/categories";
import { loadTemplate } from "@/lib/templates";
import AdminHeader from "@/app/admin/admin-header";
import TemplateEditor from "../../template-editor";

export const metadata: Metadata = {
  title: `Edit template · ${BRAND_NAME}`,
};

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const [template, { exercises: library, categories }] = await Promise.all([
    loadTemplate(supabase, id),
    loadLibrary(supabase),
  ]);
  if (!template) notFound();

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <TemplateEditor
          initial={{
            id: template.id,
            title: template.title,
            exercises: template.exercises.map((e) => ({
              name: e.name,
              sets: e.sets,
              reps: e.reps,
              instructions: e.instructions,
              media_url: e.media_url,
              library_id: e.library_id,
            })),
          }}
          library={library}
          categories={categories}
        />
      </main>
    </div>
  );
}
