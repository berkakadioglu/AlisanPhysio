import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadTemplate, loadTemplatesForPicker } from "@/lib/templates";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor from "@/app/admin/program-editor";
import { asEditorDays } from "@/app/admin/editor/day-ops";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), "ed.meta.editSavedDay") };
}

/** Edit a live saved day in the shared editor (mode "template"). */
export default async function SavedDayPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }, lang] = await Promise.all([params, requireStaff(), getLang()]);
  const [template, { exercises: library, categories }, savedDays] = await Promise.all([
    loadTemplate(supabase, id),
    loadLibrary(supabase),
    loadTemplatesForPicker(supabase),
  ]);
  // Unknown, malformed or deleted (in "Recently deleted") saved days.
  if (!template) notFound();

  const [day] = asEditorDays([
    { title: "", sourceTemplateLabel: null, exercises: template.exercises },
  ]);
  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <ProgramEditor
          mode="template"
          templateId={template.id}
          clientId={null}
          contentLang={lang}
          initial={{ title: template.title, monthStartDate: "", notes: "", days: [day] }}
          library={library}
          categories={categories}
          savedDays={savedDays}
        />
      </main>
    </div>
  );
}
