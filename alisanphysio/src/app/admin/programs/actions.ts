"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { defaultNewMonth, isMonthStart } from "@/lib/month";
import { getLang } from "@/lib/i18n-server";
import { t, type Lang } from "@/lib/i18n";
import { missingCatalogColumn, missingCatalogCopy } from "@/lib/catalog-compatibility";
import { loadEditorDays } from "@/lib/program-editor-loader";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; monthTaken?: boolean };
type ClientMonths = { usedMonths: string[]; suggestedMonth: string };

async function clientMonths(supabase: SupabaseClient, clientId: string): Promise<ClientMonths | null> {
  const { data: client, error } = await supabase.from("profiles").select("id, timezone")
    .eq("id", clientId).eq("role", "client").maybeSingle<{ id: string; timezone: string | null }>();
  if (error) throw error;
  if (!client) return null;
  const months: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("programs").select("month_start_date")
      .eq("kind", "client").eq("client_id", clientId).order("month_start_date")
      .range(offset, offset + 999).returns<{ month_start_date: string }[]>();
    if (error) throw error;
    months.push(...(data ?? []).map((row) => row.month_start_date));
    if (!data || data.length < 1000) break;
  }
  return { usedMonths: months, suggestedMonth: defaultNewMonth(months, new Date(), client.timezone) };
}

export async function getCatalogClientMonths(clientId: string): Promise<Result<ClientMonths>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(clientId)) return { ok: false, error: t(lang, "catalog.invalidClient") };
  try {
    const data = await clientMonths(supabase, clientId);
    return data ? { ok: true, ...data } : { ok: false, error: t(lang, "catalog.invalidClient") };
  } catch { return { ok: false, error: t(lang, "catalog.loadMonthsError") }; }
}

function copyError(lang: Lang, error: { code?: string; message?: string }): Result<never> {
  if (error.code === "23505") return { ok: false, monthTaken: true, error: t(lang, "err.programMonthTaken") };
  return { ok: false, error: t(lang, error.code === "P0002" ? "catalog.notFound" : "catalog.copyError") };
}

/** Compatibility for the monthly schema before the optional catalogue RPC exists. */
async function copyCatalog(supabase: SupabaseClient, input: {
  p_source_id: string; p_client_id: string | null; p_month_start_date: string | null;
  p_title: string | null; p_ungrouped_title: string;
}) {
  const result = await supabase.rpc("copy_catalog_program", input);
  // Never retry a failed transaction: only a function that was not found is safe.
  if (!missingCatalogCopy(result.error)) return result;
  const { data: source, error } = await supabase.from("programs").select("title, notes")
    .eq("id", input.p_source_id).eq("kind", "catalog").maybeSingle<{ title: string; notes: string | null }>();
  if (error) return { data: null, error };
  if (!source) return { data: null, error: { code: "P0002", message: "catalog_not_found" } };
  const days = await loadEditorDays(supabase, input.p_source_id, input.p_ungrouped_title);
  const saved = await supabase.rpc("save_program", {
    p_id: null, p_kind: input.p_client_id ? "client" : "catalog", p_client_id: input.p_client_id,
    p_month_start_date: input.p_month_start_date, p_title: input.p_title ?? source.title, p_notes: source.notes,
    p_days: days.map((day) => ({ title: day.title, source_template_label: day.sourceTemplateLabel, exercises: day.exercises.map((exercise) => ({
      name: exercise.name, sets: exercise.sets, reps: exercise.reps, instructions: exercise.instructions,
      media_url: exercise.media_url, library_id: exercise.library_id,
    })) })),
  });
  if (!saved.error && isProgramId(saved.data) && input.p_client_id) {
    // Lineage is informational. A metadata failure must never report a saved copy as failed.
    try {
      const { error: lineageError } = await supabase.from("programs").update({ source_program_id: input.p_source_id })
        .eq("id", saved.data).eq("kind", "client").eq("client_id", input.p_client_id);
      if (lineageError && !missingCatalogColumn(lineageError, "source_program_id")) {
        console.error("Catalogue copy saved; lineage could not be recorded", lineageError);
      }
    } catch (error) { console.error("Catalogue copy saved; lineage could not be recorded", error); }
  }
  return saved;
}

export async function assignCatalogProgram(input: {
  sourceId: string; clientId: string; monthStartDate: string;
}): Promise<Result<{ programId: string; href: string }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(input.sourceId)) return { ok: false, error: t(lang, "catalog.notFound") };
  if (!isProgramId(input.clientId)) return { ok: false, error: t(lang, "catalog.invalidClient") };
  if (!isMonthStart(input.monthStartDate)) return { ok: false, error: t(lang, "err.pickDate") };
  try {
    // Recheck immediately before the transaction, even if the picker was loaded earlier.
    const months = await clientMonths(supabase, input.clientId);
    if (!months) return { ok: false, error: t(lang, "catalog.invalidClient") };
    if (months.usedMonths.includes(input.monthStartDate)) return copyError(lang, { code: "23505" });
    const { data, error } = await copyCatalog(supabase, {
      p_source_id: input.sourceId, p_client_id: input.clientId,
      p_month_start_date: input.monthStartDate, p_title: null,
      p_ungrouped_title: t(lang, "editor.ungrouped"),
    });
    if (error) return copyError(lang, error);
    if (!isProgramId(data)) return copyError(lang, {});
    const href = `/admin/clients/${input.clientId}/programs/${data}/edit`;
    revalidatePath("/admin/programs");
    revalidatePath(`/admin/clients/${input.clientId}`);
    revalidatePath("/dashboard", "layout");
    return { ok: true, programId: data, href };
  } catch { return copyError(lang, {}); }
}

export async function duplicateCatalogProgram(sourceId: string): Promise<Result<{ programId: string }>> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(sourceId)) return { ok: false, error: t(lang, "catalog.notFound") };
  try {
    const { data: source, error: readError } = await supabase.from("programs").select("title")
      .eq("id", sourceId).eq("kind", "catalog").maybeSingle<{ title: string }>();
    if (readError) return copyError(lang, readError);
    if (!source) return { ok: false, error: t(lang, "catalog.notFound") };
    const { data, error } = await copyCatalog(supabase, {
      p_source_id: sourceId, p_client_id: null, p_month_start_date: null,
      p_title: t(lang, "catalog.copyTitle", { title: source.title.slice(0, 280) }),
      p_ungrouped_title: t(lang, "editor.ungrouped"),
    });
    if (error) return copyError(lang, error);
    if (!isProgramId(data)) return copyError(lang, {});
    revalidatePath("/admin/programs");
    return { ok: true, programId: data };
  } catch { return copyError(lang, {}); }
}

export async function deleteCatalogProgram(programId: string): Promise<Result> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!isProgramId(programId)) return { ok: false, error: t(lang, "catalog.notFound") };
  try {
    const { data, error } = await supabase.from("programs").delete()
      .eq("id", programId).eq("kind", "catalog").select("id").maybeSingle();
    if (error) return { ok: false, error: t(lang, "catalog.deleteError") };
    if (!data) return { ok: false, error: t(lang, "catalog.notFound") };
    revalidatePath("/admin/programs");
    revalidatePath(`/admin/programs/${programId}/edit`);
    return { ok: true };
  } catch { return { ok: false, error: t(lang, "catalog.deleteError") }; }
}
