import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { loadLibrary } from "@/lib/categories";
import { loadTemplatesForPicker } from "@/lib/templates";
import { defaultNewMonth, nextMonthISO } from "@/lib/month";
import { monthTitle, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { loadEditorDays } from "@/lib/program-editor-loader";
import type { Program } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import ProgramEditor from "@/app/admin/program-editor";

export default async function NewProgramPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ copyFrom?: string }>;
}) {
  const [{ id }, { copyFrom }, { supabase }, lang] = await Promise.all([params, searchParams, requireStaff(), getLang()]);
  const { data: client } = await supabase.from("profiles").select("id, timezone").eq("id", id).maybeSingle();
  if (!client) notFound();
  const [{ exercises: library, categories }, templates, used] = await Promise.all([
    loadLibrary(supabase), loadTemplatesForPicker(supabase),
    supabase.from("programs").select("month_start_date").eq("kind", "client").eq("client_id", id),
  ]);
  if (used.error) throw new Error("Could not load programme months");
  const usedMonths = (used.data ?? []).map((p) => p.month_start_date as string);
  let month = defaultNewMonth(usedMonths, new Date(), client.timezone);
  let notes = "";
  let days: Awaited<ReturnType<typeof loadEditorDays>> = [];
  if (copyFrom) {
    // A copy source is explicitly either this client's programme OR a catalogue.
    const { data: own } = await supabase.from("programs").select("*").eq("kind", "client").eq("client_id", id).eq("id", copyFrom).maybeSingle<Program>();
    const { data: catalog } = own ? { data: null } : await supabase.from("programs").select("*").eq("kind", "catalog").eq("id", copyFrom).maybeSingle<Program>();
    const source = own ?? catalog;
    if (!source) notFound();
    if (source.kind === "catalog") redirect(`/admin/programs/${source.id}/assign?client=${id}`);
    if (source.kind === "client") month = nextMonthISO(source.month_start_date);
    days = await loadEditorDays(supabase, source.id, t(lang, "editor.ungrouped"));
    notes = source.notes ?? "";
  }
  return <div className="min-h-screen"><AdminHeader container="max-w-3xl" />
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <ProgramEditor clientId={id} timeZone={client.timezone} initial={{ title: monthTitle(month, lang), monthStartDate: month, notes, days }} library={library} categories={categories} templates={templates} usedMonths={usedMonths} />
    </main></div>;
}
