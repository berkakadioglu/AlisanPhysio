import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { isLang, type Lang } from "@/lib/i18n";
import { renderProgramPdf, type ProgramDoc } from "@/lib/pdf/program-pdf";
import {
  attachThumbnails,
  pdfFilename,
  pdfResponse,
  singleDay,
  type RawExercise,
} from "@/lib/pdf/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExRow = RawExercise & {
  exercise_library: { youtube_url: string | null } | null;
};

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

  const { data: template } = await supabase
    .from("day_templates")
    .select("id, title")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string }>();
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

  const withThumbs = await attachThumbnails(doc);
  const buf = await renderProgramPdf(withThumbs, lang);
  return pdfResponse(buf, pdfFilename(template.title, lang), inline);
}
