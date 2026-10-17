import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadTemplatesForPicker } from "@/lib/templates";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor from "@/app/admin/program-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), "ed.meta.newSavedDay") };
}

/** A brand-new saved day in the shared editor (mode "template"). */
export default async function NewSavedDayPage() {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  const [{ exercises: library, categories }, savedDays] = await Promise.all([
    loadLibrary(supabase),
    loadTemplatesForPicker(supabase),
  ]);
  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <ProgramEditor
          mode="template"
          clientId={null}
          contentLang={lang}
          initial={{
            title: "",
            monthStartDate: "",
            notes: "",
            days: [{ title: "", sourceTemplateLabel: null, sourceTemplateId: null, exercises: [] }],
          }}
          library={library}
          categories={categories}
          savedDays={savedDays}
        />
      </main>
    </div>
  );
}
