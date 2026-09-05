import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadTemplatesForPicker } from "@/lib/templates";
import { loadEditorDays } from "@/lib/program-editor-loader";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import type { ClientProgram } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor from "@/app/admin/program-editor";
export default async function EditProgramPage({ params }: { params: Promise<{ id: string; programId: string }> }) {
  const [{ id, programId }, { supabase }, lang] = await Promise.all([params, requireStaff(), getLang()]);
  const { data: program } = await supabase.from("programs").select("*").eq("kind", "client").eq("client_id", id).eq("id", programId).maybeSingle<ClientProgram>();
  if (!program) notFound();
  const [days, { exercises: library, categories }, templates, used, client] = await Promise.all([
    loadEditorDays(supabase, programId, t(lang, "editor.ungrouped")), loadLibrary(supabase), loadTemplatesForPicker(supabase),
    supabase.from("programs").select("month_start_date").eq("kind", "client").eq("client_id", id),
    supabase.from("profiles").select("timezone").eq("id", id).maybeSingle(),
  ]);
  if (used.error) throw new Error("Could not load programme months");
  return <div className="min-h-screen"><AdminHeader container="max-w-3xl" /><main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
    <ProgramEditor clientId={id} timeZone={client.data?.timezone} programId={programId} initial={{ title: program.title, monthStartDate: program.month_start_date, notes: program.notes ?? "", days }} library={library} categories={categories} templates={templates} usedMonths={(used.data ?? []).map((p) => p.month_start_date)} />
  </main></div>;
}
