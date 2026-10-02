import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadSavedDaysForEditor } from "@/lib/templates";
import { defaultNewMonth, nextMonthISO } from "@/lib/month";
import { isLang, monthTitle, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { loadEditorDays } from "@/lib/program-editor-loader";
import type { EditorDay } from "@/lib/program-editor-model";
import type { Program } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor from "@/app/admin/program-editor";
import { asEditorDays } from "@/app/admin/editor/day-ops";

export default async function NewProgramPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ copyFrom?: string }>;
}) {
  const [{ id }, { copyFrom }, { supabase }, lang] = await Promise.all([params, searchParams, requireStaff(), getLang()]);
  const { data: client } = await supabase.from("profiles").select("id, full_name, language, timezone").eq("id", id).maybeSingle();
  if (!client) notFound();
  const [{ exercises: library, categories }, { savedDays, savedDaysFailed }, used] = await Promise.all([
    loadLibrary(supabase), loadSavedDaysForEditor(supabase),
    supabase.from("programs").select("month_start_date").eq("kind", "client").eq("client_id", id),
  ]);
  if (used.error) throw new Error("Could not load programme months");
  const usedMonths = (used.data ?? []).map((p) => p.month_start_date as string);
  let month = defaultNewMonth(usedMonths, new Date(), client.timezone);
  let notes = "";
  let days: EditorDay[] = [];
  if (copyFrom) {
    // A copy source is explicitly either this client's programme OR a catalogue.
    const { data: own } = await supabase.from("programs").select("*").eq("kind", "client").eq("client_id", id).eq("id", copyFrom).maybeSingle<Program>();
    const { data: catalog } = own ? { data: null } : await supabase.from("programs").select("*").eq("kind", "catalog").eq("id", copyFrom).maybeSingle<Program>();
    const source = own ?? catalog;
    if (!source) notFound();
    if (source.kind === "catalog") redirect(`/admin/programs/${source.id}/assign?client=${id}`);
    if (source.kind === "client") month = nextMonthISO(source.month_start_date);
    days = asEditorDays(await loadEditorDays(supabase, source.id, t(lang, "editor.ungrouped")));
    notes = source.notes ?? "";
  }
  return <div className="min-h-screen"><AdminHeader container="max-w-6xl" />
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <ProgramEditor mode="client" clientId={id} clientName={client.full_name} contentLang={isLang(client.language) ? client.language : lang}
        timeZone={client.timezone} initial={{ title: monthTitle(month, lang), monthStartDate: month, notes, days }}
        library={library} categories={categories} savedDays={savedDays} savedDaysFailed={savedDaysFailed} usedMonths={usedMonths} />
    </main></div>;
}
