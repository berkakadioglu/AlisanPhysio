import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { isLang, type Lang } from "@/lib/i18n";
import {
  renderProgramPdf,
  type PdfDay,
  type ProgramDoc,
} from "@/lib/pdf/program-pdf";
import {
  attachThumbnails,
  pdfFilename,
  pdfResponse,
  resolveVideoId,
} from "@/lib/pdf/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InExercise {
  name?: string;
  sets?: number | string | null;
  reps?: string | null;
  instructions?: string | null;
  media_url?: string | null;
  library_id?: string | null;
}
interface InDay {
  title?: string | null;
  exercises?: InExercise[];
}
interface InBody {
  lang?: string;
  title?: string;
  notes?: string | null;
  monthStart?: string | null;
  clientName?: string | null;
  days?: InDay[];
}

function coerceSets(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Export the program/template currently being AUTHORED (the editor's live
 * state, including unsaved edits and brand-new programs). Staff-gated. Video
 * ids are resolved server-side from the linked library entries.
 */
export async function POST(req: NextRequest) {
  const { supabase } = await requireStaff();

  let body: InBody;
  try {
    body = (await req.json()) as InBody;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const lang: Lang = isLang(body.lang) ? body.lang : "en";
  const title = (body.title ?? "").trim() || "Program";

  // Keep only exercises with a name, and days that still have exercises.
  const rawDays = (body.days ?? [])
    .map((d) => ({
      title: (d.title ?? "").trim() || null,
      exercises: (d.exercises ?? []).filter(
        (e) => (e.name ?? "").trim() !== "",
      ),
    }))
    .filter((d) => d.exercises.length > 0);

  // Resolve youtube_url for every linked library entry in one query.
  const libIds = [
    ...new Set(
      rawDays.flatMap((d) =>
        d.exercises.map((e) => e.library_id).filter((x): x is string => !!x),
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
      name: (e.name ?? "").trim(),
      sets: coerceSets(e.sets),
      reps: (e.reps ?? "").trim() || null,
      instructions: (e.instructions ?? "").trim() || null,
      videoId: resolveVideoId(
        e.library_id ? ytById.get(e.library_id) ?? null : null,
        e.media_url ?? null,
      ),
      thumb: null,
    })),
  }));

  const doc: ProgramDoc = {
    title,
    notes: (body.notes ?? "").trim() || null,
    monthStart: body.monthStart ?? null,
    clientName: (body.clientName ?? "").trim() || null,
    days,
  };

  const withThumbs = await attachThumbnails(doc);
  const buf = await renderProgramPdf(withThumbs, lang);
  return pdfResponse(buf, pdfFilename(title, lang), false);
}
