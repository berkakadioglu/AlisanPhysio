import { parseYouTubeId, youtubeThumb } from "@/lib/youtube";
import type { Lang } from "@/lib/i18n";
import type { PdfDay, PdfExercise, ProgramDoc } from "./program-pdf";

/** A raw exercise from either the DB or the editor's live state. */
export interface RawExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
  day_id?: string | null;
  /** youtube_url resolved from the linked library entry (if any). */
  youtube_url?: string | null;
}

function toPdfExercise(e: RawExercise): PdfExercise {
  return {
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    instructions: e.instructions,
    videoId: resolveVideoId(e.youtube_url, e.media_url),
    thumb: null,
  };
}

/**
 * Group flat exercises into the program's days (mirrors the client program view):
 * ordered days, with any dayless exercises collected into a trailing section.
 * Days with no exercises are dropped. A dayless program becomes one section.
 */
export function groupIntoDays(
  dayRows: { id: string; title: string | null }[],
  exercises: RawExercise[],
): PdfDay[] {
  if (dayRows.length > 0) {
    const days: PdfDay[] = dayRows.map((d) => ({
      title: d.title,
      exercises: exercises.filter((e) => e.day_id === d.id).map(toPdfExercise),
    }));
    const orphans = exercises
      .filter((e) => !dayRows.some((d) => d.id === e.day_id))
      .map(toPdfExercise);
    if (orphans.length > 0) days.push({ title: null, exercises: orphans });
    return days.filter((d) => d.exercises.length > 0);
  }
  return exercises.length > 0
    ? [{ title: null, exercises: exercises.map(toPdfExercise) }]
    : [];
}

/** A single flat section (used for templates, which have no days). */
export function singleDay(exercises: RawExercise[]): PdfDay[] {
  return exercises.length > 0
    ? [{ title: null, exercises: exercises.map(toPdfExercise) }]
    : [];
}

/** Build the standard PDF Response (download by default; inline for previewing). */
export function pdfResponse(
  buf: Buffer,
  filename: string,
  inline = false,
): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Resolve a YouTube video id from a library youtube_url (preferred) or a
 *  per-exercise media_url override. Null when neither is a valid YouTube link. */
export function resolveVideoId(
  youtubeUrl: string | null | undefined,
  mediaUrl: string | null | undefined,
): string | null {
  return parseYouTubeId(youtubeUrl ?? mediaUrl ?? null);
}

/**
 * Fetch a YouTube thumbnail and return it as a base64 data URI, or null.
 * Robust by design: a network error, non-200, or the tiny gray "no thumbnail"
 * placeholder YouTube serves for invalid ids all resolve to null (→ no tile),
 * never a broken image or a thrown export.
 */
async function fetchThumb(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(youtubeThumb(videoId), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Invalid ids yield a ~1KB gray placeholder — require a real thumbnail.
    if (buf.length < 2000) return null;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Fetch every distinct video thumbnail (in parallel, deduped) and attach them
 * to the doc's exercises. A failed fetch simply leaves `thumb: null`.
 */
export async function attachThumbnails(doc: ProgramDoc): Promise<ProgramDoc> {
  const ids = new Set<string>();
  for (const day of doc.days)
    for (const ex of day.exercises) if (ex.videoId) ids.add(ex.videoId);

  const pairs = await Promise.all(
    [...ids].map(async (id) => [id, await fetchThumb(id)] as const),
  );
  const byId = new Map(pairs);

  return {
    ...doc,
    days: doc.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        thumb: ex.videoId ? byId.get(ex.videoId) ?? null : null,
      })),
    })),
  };
}

/** Filesystem-safe slug (handles Turkish letters via NFKD → ASCII). */
export function slugify(s: string): string {
  const out = (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
  return out || "program";
}

export function pdfFilename(title: string, lang: Lang): string {
  return `alisanphysio-${slugify(title)}-${lang}.pdf`;
}
