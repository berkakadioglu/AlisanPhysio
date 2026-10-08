import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { isLang, type Lang } from "@/lib/i18n";
import type { ProgramDoc } from "@/lib/pdf/program-pdf";
import { exportProgramPdf, pdfFilename, singleDay, type RawExercise } from "@/lib/pdf/build";
import { deliverPdf, deliveryFailure, pdfDelivery } from "@/lib/pdf/delivery";
import { missingSavedDayColumn } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Measured 1–4 s for a 38-exercise programme; the cap stops a runaway render.
export const maxDuration = 60;

type ExRow = RawExercise & {
  exercise_library: { youtube_url: string | null } | null;
};

type SavedDayHeader = { id: string; title: string };

/**
 * The saved day's id and title — LIVE rows only: a saved day in "Recently
 * deleted" exports like a missing one (404), as it opens nowhere else either.
 * Before migration 0021 there is no deleted_at column (and nothing can be
 * deleted yet), so the lookup falls back to the plain query.
 */
async function loadLiveSavedDay(
  supabase: SupabaseClient,
  id: string,
): Promise<SavedDayHeader | null> {
  const live = await supabase
    .from("day_templates")
    .select("id, title")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<SavedDayHeader>();
  if (!missingSavedDayColumn(live.error)) return live.data ?? null;
  const legacy = await supabase
    .from("day_templates")
    .select("id, title")
    .eq("id", id)
    .maybeSingle<SavedDayHeader>();
  return legacy.data ?? null;
}

/** Export a day template as a standalone program document (PDF). Staff-gated.
 *  This is the sales path — a custom program built from a template. Inline
 *  when opened directly; the button asks for `download=1&token=…`. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase } = await requireStaff();
  const { id } = await params;
  const url = new URL(req.url);
  const langParam = url.searchParams.get("lang");
  const lang: Lang = isLang(langParam) ? langParam : "en";
  const delivery = pdfDelivery(url);

  if (!isProgramId(id)) return deliveryFailure(delivery, 404, "Not found");
  const template = await loadLiveSavedDay(supabase, id);
  if (!template) return deliveryFailure(delivery, 404, "Not found");

  const { data: exRows } = await supabase
    .from("day_template_exercises")
    .select(
      "name, sets, reps, instructions, media_url, library_id, order_index, exercise_library(youtube_url)",
    )
    .eq("template_id", id)
    .order("order_index", { ascending: true })
    .returns<ExRow[]>();

  const exercises: RawExercise[] = (exRows ?? []).map((e) => ({
    ...e,
    youtube_url: e.exercise_library?.youtube_url ?? null,
  }));

  const doc: ProgramDoc = {
    title: template.title,
    notes: null,
    monthStart: null,
    clientName: null,
    days: singleDay(exercises),
  };

  try {
    const buf = await exportProgramPdf(doc, lang);
    return deliverPdf(buf, pdfFilename(template.title, lang), delivery);
  } catch (err) {
    console.error(`[pdf-export] template ${id} (${lang}) failed`, err);
    return deliveryFailure(delivery, 500, "PDF export failed");
  }
}
