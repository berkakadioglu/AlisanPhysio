import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadSavedDaysForEditor } from "@/lib/templates";
import { loadEditorDays } from "@/lib/program-editor-loader";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import type { CatalogProgram } from "@/lib/types";
import AdminHeader from "./admin-header";
import ProgramEditor from "./program-editor";
import { asEditorDays } from "./editor/day-ops";

/** `initialDayIndex`: the edit page's `?day=N` (0-based here). */
export default async function CatalogProgramPage({ id, initialDayIndex = 0 }: { id?: string; initialDayIndex?: number }) {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  const program = id ? (await supabase.from("programs").select("*").eq("kind", "catalog").eq("id", id).maybeSingle<CatalogProgram>()).data : null;
  if (id && !program) notFound();
  const [{ exercises: library, categories }, { savedDays, savedDaysFailed }, days] = await Promise.all([
    loadLibrary(supabase), loadSavedDaysForEditor(supabase),
    id ? loadEditorDays(supabase, id, t(lang, "editor.ungrouped")) : Promise.resolve([]),
  ]);
  // "Assign to client" lives in the editor's ⋯ menu.
  return <div className="min-h-screen"><AdminHeader container="max-w-6xl" /><main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
    <ProgramEditor mode="catalog" clientId={null} programId={id} initialDayIndex={initialDayIndex} contentLang={lang} library={library} categories={categories} savedDays={savedDays} savedDaysFailed={savedDaysFailed}
      initial={{ title: program?.title ?? "", monthStartDate: "", notes: program?.notes ?? "", days: asEditorDays(days) }} />
  </main></div>;
}
