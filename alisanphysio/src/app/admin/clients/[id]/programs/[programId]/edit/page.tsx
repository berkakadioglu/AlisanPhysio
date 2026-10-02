import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadSavedDaysForEditor } from "@/lib/templates";
import { loadEditorDays } from "@/lib/program-editor-loader";
import { getLang } from "@/lib/i18n-server";
import { isLang, t } from "@/lib/i18n";
import type { ClientProgram } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor from "@/app/admin/program-editor";
import { asEditorDays, dayIndexFromParam } from "@/app/admin/editor/day-ops";
export default async function EditProgramPage({ params, searchParams }: {
  params: Promise<{ id: string; programId: string }>; searchParams: Promise<{ day?: string | string[] }>;
}) {
  const [{ id, programId }, { day }, { supabase }, lang] = await Promise.all([params, searchParams, requireStaff(), getLang()]);
  const { data: program } = await supabase.from("programs").select("*").eq("kind", "client").eq("client_id", id).eq("id", programId).maybeSingle<ClientProgram>();
  if (!program) notFound();
  const [days, { exercises: library, categories }, { savedDays, savedDaysFailed }, used, client] = await Promise.all([
    loadEditorDays(supabase, programId, t(lang, "editor.ungrouped")), loadLibrary(supabase), loadSavedDaysForEditor(supabase),
    supabase.from("programs").select("month_start_date").eq("kind", "client").eq("client_id", id),
    supabase.from("profiles").select("full_name, language, timezone").eq("id", id).maybeSingle(),
  ]);
  if (used.error) throw new Error("Could not load programme months");
  const language = client.data?.language;
  return <div className="min-h-screen"><AdminHeader container="max-w-6xl" /><main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
    <ProgramEditor mode="client" clientId={id} clientName={client.data?.full_name ?? null} contentLang={isLang(language) ? language : lang}
      timeZone={client.data?.timezone} programId={programId} initialDayIndex={dayIndexFromParam(day)}
      initial={{ title: program.title, monthStartDate: program.month_start_date, notes: program.notes ?? "", days: asEditorDays(days) }}
      library={library} categories={categories} savedDays={savedDays} savedDaysFailed={savedDaysFailed} usedMonths={(used.data ?? []).map((p) => p.month_start_date)} />
  </main></div>;
}
