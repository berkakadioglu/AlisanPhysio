import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { isLang, type Lang } from "@/lib/i18n";
import type { ProgramDoc } from "@/lib/pdf/program-pdf";
import {
  exportProgramPdf,
  pdfFilename,
  pdfResponse,
  singleDay,
  type RawExercise,
} from "@/lib/pdf/build";
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
 *  This is the sales path — a custom program built from a template. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase } = await requireStaff();
  const { id } = await params;
  const url = new URL(req.url);
  const langParam = url.searchParams.get("lang");
  const lang: Lang = isLang(langParam) ? langParam : "en";
  const inline = url.searchParams.get("inline") === "1";

  if (!isProgramId(id)) return new Response("Not found", { status: 404 });
  const template = await loadLiveSavedDay(supabase, id);
  if (!template) return new Response("Not found", { status: 404 });

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
    return pdfResponse(buf, pdfFilename(template.title, lang), inline);
  } catch (err) {
    console.error(`[pdf-export] template ${id} (${lang}) failed`, err);
    return new Response("PDF export failed", { status: 500 });
  }
}
