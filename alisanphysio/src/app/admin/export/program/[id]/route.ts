import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { isLang, type Lang } from "@/lib/i18n";
import type { Program } from "@/lib/types";
import type { ProgramDoc } from "@/lib/pdf/program-pdf";
import {
  exportProgramPdf,
  groupIntoDays,
  pdfFilename,
  pdfResponse,
  type RawExercise,
} from "@/lib/pdf/build";

// react-pdf + fs font reads need the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Measured 1–4 s for a 38-exercise programme; the cap stops a runaway render.
export const maxDuration = 60;

type ExRow = RawExercise & {
  day_id: string | null;
  exercise_library: { youtube_url: string | null } | null;
};

/** Export a saved program (by id) as a standalone PDF. Staff-gated. */
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

  const { data: program } = await supabase
    .from("programs")
    .select("id, kind, client_id, title, month_start_date, notes")
    .eq("id", id)
    .maybeSingle<Program>();
  if (!program) return new Response("Not found", { status: 404 });

  const [{ data: exRows }, { data: dayRows }, { data: profile }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select(
          "name, sets, reps, instructions, media_url, library_id, day_id, order_index, exercise_library(youtube_url)",
        )
        .eq("program_id", id)
        .order("order_index", { ascending: true })
        .returns<ExRow[]>(),
      supabase
        .from("program_days")
        .select("id, title, order_index")
        .eq("program_id", id)
        .order("order_index", { ascending: true })
        .returns<{ id: string; title: string | null; order_index: number }[]>(),
      program.kind === "client" ? supabase
        .from("profiles")
        .select("full_name")
        .eq("id", program.client_id)
        .maybeSingle<{ full_name: string | null }>() : Promise.resolve({ data: null }),
    ]);

  const exercises: RawExercise[] = (exRows ?? []).map((e) => ({
    ...e,
    youtube_url: e.exercise_library?.youtube_url ?? null,
  }));

  const doc: ProgramDoc = {
    title: program.title,
    notes: program.notes,
    monthStart: program.month_start_date,
    clientName: program.kind === "client" ? profile?.full_name?.trim() || null : null,
    days: groupIntoDays(dayRows ?? [], exercises),
  };

  try {
    const buf = await exportProgramPdf(doc, lang);
    return pdfResponse(buf, pdfFilename(program.title, lang), inline);
  } catch (err) {
    console.error(`[pdf-export] program ${id} (${lang}) failed`, err);
    return new Response("PDF export failed", { status: 500 });
  }
}
