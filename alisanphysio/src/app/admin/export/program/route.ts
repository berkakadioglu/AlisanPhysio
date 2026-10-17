import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { isLang, t, type Lang } from "@/lib/i18n";
import { isMonthStart } from "@/lib/month";
import type { PdfDay, ProgramDoc } from "@/lib/pdf/program-pdf";
import { exportProgramPdf, pdfFileName, pdfResponse } from "@/lib/pdf/build";
import { PDF_CLIENT_NAME_MAX, PDF_TITLE_MAX, clampText } from "@/lib/pdf/pdf-text";
import { effectiveVideoId } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Measured 1–4 s for a 38-exercise programme; the cap stops a runaway render.
export const maxDuration = 60;

// The body comes from the editor, but is still untrusted: fields are read as
// `unknown` and coerced.
interface InExercise {
  name?: unknown;
  sets?: unknown;
  reps?: unknown;
  instructions?: unknown;
  media_url?: unknown;
  library_id?: unknown;
}
interface InDay {
  title?: unknown;
  exercises?: unknown;
}
interface InBody {
  lang?: unknown;
  title?: unknown;
  kind?: unknown;
  notes?: unknown;
  monthStart?: unknown;
  clientName?: unknown;
  days?: unknown;
}

/** A trimmed string, or "" for anything that isn't one. */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function coerceSets(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Export the program/template currently being AUTHORED (the editor's live
 * state, including unsaved edits and brand-new programs). Staff-gated. Video
 * ids are resolved server-side: the exercise's own override, else the linked
 * library entry's video.
 */
export async function POST(req: NextRequest) {
  const { supabase } = await requireStaff();

  let body: InBody;
  try {
    body = (await req.json()) as InBody;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!body || typeof body !== "object" || (body.days != null && !Array.isArray(body.days)))
    return new Response("Bad request", { status: 400 });

  const lang: Lang = isLang(body.lang) ? body.lang : "en";
  // Same limits as the database (titles ≤ 300 characters), so a direct POST
  // can't push the cover onto extra pages. An untitled export falls back in the
  // EXPORT language, not the viewer's.
  const title =
    clampText(str(body.title), PDF_TITLE_MAX) ||
    t(lang, body.kind === "template" ? "ed.fallback.savedDay" : "ed.fallback.programme");

  // Keep only exercises with a name, and days that still have exercises.
  const rawDays = ((body.days ?? []) as InDay[])
    .filter((d): d is InDay => !!d && typeof d === "object")
    .map((d) => ({
      title: str(d.title) || null,
      exercises: (Array.isArray(d.exercises) ? (d.exercises as InExercise[]) : []).filter(
        (e) => !!e && typeof e === "object" && str(e.name) !== "",
      ),
    }))
    .filter((d) => d.exercises.length > 0);

  // Resolve youtube_url for every linked library entry in one query.
  const libIds = [
    ...new Set(
      rawDays.flatMap((d) =>
        d.exercises.map((e) => str(e.library_id)).filter(Boolean),
      ),
    ),
  ];
  const ytById = new Map<string, string | null>();
  if (libIds.length > 0) {
    const { data: libs } = await supabase
      .from("exercise_library")
      .select("id, youtube_url")
      .in("id", libIds)
      .returns<{ id: string; youtube_url: string | null }[]>();
    for (const l of libs ?? []) ytById.set(l.id, l.youtube_url);
  }

  const days: PdfDay[] = rawDays.map((d) => ({
    title: d.title,
    exercises: d.exercises.map((e) => ({
      name: str(e.name),
      sets: coerceSets(e.sets),
      reps: str(e.reps) || null,
      instructions: str(e.instructions) || null,
      // The exercise's own video override wins over the library video.
      videoId: effectiveVideoId(
        str(e.media_url) || null,
        ytById.get(str(e.library_id)) ?? null,
      ),
      thumb: null,
    })),
  }));

  const doc: ProgramDoc = {
    title,
    notes: str(body.notes) || null,
    // Only a real month start reaches the cover's month formatter.
    monthStart: isMonthStart(body.monthStart) ? body.monthStart : null,
    clientName: clampText(str(body.clientName), PDF_CLIENT_NAME_MAX) || null,
    days,
  };

  try {
    const buf = await exportProgramPdf(doc, lang);
    return pdfResponse(buf, pdfFileName(title, lang), false);
  } catch (err) {
    console.error(`[pdf-export] editor export (${lang}) failed`, err);
    return new Response("PDF export failed", { status: 500 });
  }
}
