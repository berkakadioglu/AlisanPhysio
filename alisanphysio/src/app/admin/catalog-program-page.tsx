import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadTemplatesForPicker } from "@/lib/templates";
import { loadEditorDays } from "@/lib/program-editor-loader";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import type { CatalogProgram } from "@/lib/types";
import AdminHeader from "./admin-header";
import ProgramEditor from "./program-editor";
export default async function CatalogProgramPage({ id }: { id?: string }) {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  const program = id ? (await supabase.from("programs").select("*").eq("kind", "catalog").eq("id", id).maybeSingle<CatalogProgram>()).data : null;
  if (id && !program) notFound();
  const [{ exercises: library, categories }, templates, days] = await Promise.all([
    loadLibrary(supabase), loadTemplatesForPicker(supabase),
    id ? loadEditorDays(supabase, id, t(lang, "editor.ungrouped")) : Promise.resolve([]),
  ]);
  return <div className="min-h-screen"><AdminHeader container="max-w-3xl" /><main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
    <p className="mb-4 text-sm font-semibold text-brand">{t(lang, "catalog.label")}</p>
    <ProgramEditor kind="catalog" clientId={null} programId={id} library={library} categories={categories} templates={templates}
      initial={{ title: program?.title ?? "", monthStartDate: "", notes: program?.notes ?? "", days }} />
    {id && <Link href={`/admin/programs/${id}/assign`} className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-brand">{t(lang, "catalog.assign")}</Link>}
  </main></div>;
}
