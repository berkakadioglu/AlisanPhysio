import { effectiveVideoId, youtubeThumb } from "@/lib/youtube";
import type { Lang } from "@/lib/i18n";
import {
  renderProgramPdf,
  type PdfDay,
  type PdfExercise,
  type ProgramDoc,
} from "./program-pdf";

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

/** The exercise's own video override (media_url) wins over the library video. */
const videoIdOf = (e: RawExercise) => effectiveVideoId(e.media_url, e.youtube_url);

function toPdfExercise(e: RawExercise): PdfExercise {
  return {
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    instructions: e.instructions,
    videoId: videoIdOf(e),
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

// ---------------------------------------------------------------------------
// Thumbnails — one fetch per distinct video, a few at a time, each with its own
// timeout and all under one overall deadline. Any failure (network error,
// timeout, non-200, oversized, not a complete JPEG) yields null and the
// exercise gets a placeholder tile — a thumbnail can never fail the export.
// ---------------------------------------------------------------------------
export interface ThumbnailOptions {
  /** Injectable fetch (tests). Must honour `init.signal`. */
  fetch?: typeof fetch;
  /** Thumbnail URL for a video id (tests can point it at a local server). */
  thumbUrl?: (videoId: string) => string;
  /** Requests in flight at once. */
  concurrency?: number;
  /** Per request, headers + body (ms). */
  timeoutMs?: number;
  /** Overall budget for all thumbnails (ms); unfinished ones become null. */
  deadlineMs?: number;
  /** Largest accepted image (bytes), checked on Content-Length and while reading. */
  maxBytes?: number;
}

const THUMB_DEFAULTS = {
  concurrency: 6,
  timeoutMs: 3_000,
  deadlineMs: 5_000,
  // hqdefault.jpg is 5–40 KB; the cap keeps a big programme far below
  // Vercel's 4.5 MB response limit.
  maxBytes: 128 * 1024,
};

/** YouTube's grey "no thumbnail" placeholder is ~1 KB (served with a 404). */
const MIN_THUMB_BYTES = 2_000;

/** SOFn frame markers (C0–CF except DHT C4, JPG C8, DAC CC). */
const isSof = (m: number) =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/**
 * A complete JPEG with a frame header: SOI at the start, EOI at the end and an
 * SOFn with real dimensions before the first scan. Bytes that start like a JPEG
 * but have no frame header make pdfkit throw "Invalid JPEG." and fail the PDF.
 */
function isEmbeddableJpeg(b: Uint8Array): boolean {
  const n = b.length;
  if (n < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[n - 2] !== 0xff || b[n - 1] !== 0xd9)
    return false;
  let pos = 2;
  while (pos + 4 <= n) {
    if (b[pos] !== 0xff) return false;
    const marker = b[pos + 1];
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2; // standalone markers
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return false; // scan/end before a frame
    const len = (b[pos + 2] << 8) | b[pos + 3];
    if (len < 2 || pos + 2 + len > n) return false;
    if (isSof(marker)) {
      if (len < 8) return false;
      const height = (b[pos + 5] << 8) | b[pos + 6];
      const width = (b[pos + 7] << 8) | b[pos + 8];
      const components = b[pos + 9];
      return width > 0 && height > 0 && [1, 3, 4].includes(components);
    }
    pos += 2 + len;
  }
  return false;
}

/**
 * A data URI for a complete JPEG, else null. YouTube's hqdefault thumbnails are
 * always JPEG, which pdfkit embeds without decoding. PNGs are refused on
 * purpose: pdfkit decodes them, and corrupt pixel data can throw inside a zlib
 * callback, where no try/catch can reach it and the export hangs.
 */
export function imageDataUri(bytes: Uint8Array): string | null {
  if (bytes.length < MIN_THUMB_BYTES || !isEmbeddableJpeg(bytes)) return null;
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Read a body, giving up (null) once it passes `maxBytes`. */
async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Buffer | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); // rejects if the signal aborts
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

type ResolvedThumbnailOptions = Required<ThumbnailOptions>;

async function fetchThumb(
  videoId: string,
  opts: ResolvedThumbnailOptions,
  deadline: AbortSignal,
): Promise<string | null> {
  if (deadline.aborted) return null;
  try {
    const signal = AbortSignal.any([deadline, AbortSignal.timeout(opts.timeoutMs)]);
    const res = await opts.fetch(opts.thumbUrl(videoId), { signal });
    const declared = Number(res.headers.get("content-length") ?? NaN);
    if (!res.ok || !res.body || declared > opts.maxBytes) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const bytes = await readCapped(res.body, opts.maxBytes);
    return bytes ? imageDataUri(bytes) : null;
  } catch {
    return null; // network error, refused, timeout, deadline, aborted body
  }
}

/** Run `fn` over `items` with at most `limit` in flight; results keep order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  );
  return out;
}

/** Fetch every distinct video thumbnail and attach it to the doc's exercises.
 *  Never throws; takes at most `deadlineMs` however the remote behaves. */
export async function attachThumbnails(
  doc: ProgramDoc,
  options: ThumbnailOptions = {},
): Promise<ProgramDoc> {
  const opts: ResolvedThumbnailOptions = {
    ...THUMB_DEFAULTS,
    ...options,
    fetch: options.fetch ?? fetch,
    thumbUrl: options.thumbUrl ?? youtubeThumb,
  };
  const ids = [
    ...new Set(
      doc.days
        .flatMap((d) => d.exercises.map((e) => e.videoId))
        .filter((id): id is string => !!id),
    ),
  ];

  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), opts.deadlineMs);
  let thumbs: (string | null)[];
  try {
    thumbs = await mapWithConcurrency(ids, opts.concurrency, (id) =>
      fetchThumb(id, opts, deadline.signal),
    );
  } finally {
    clearTimeout(timer);
  }
  const byId = new Map(ids.map((id, i) => [id, thumbs[i]]));
  return withThumbs(doc, (videoId) => byId.get(videoId) ?? null);
}

function withThumbs(
  doc: ProgramDoc,
  thumbFor: (videoId: string) => string | null,
): ProgramDoc {
  return {
    ...doc,
    days: doc.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        thumb: ex.videoId ? thumbFor(ex.videoId) : null,
      })),
    })),
  };
}

/**
 * Fetch thumbnails, then render. If rendering fails on an image, log it and
 * render once more with placeholder tiles, so one bad image can never cost the
 * whole document. Any other failure throws straight away.
 */
export async function exportProgramPdf(
  doc: ProgramDoc,
  lang: Lang,
  options: ThumbnailOptions = {},
): Promise<Buffer> {
  const withImages = await attachThumbnails(doc, options);
  try {
    return await renderProgramPdf(withImages, lang);
  } catch (err) {
    const hadImages = withImages.days.some((d) => d.exercises.some((e) => e.thumb));
    const aboutImage = err instanceof Error && /jpe?g|png|image/i.test(err.message);
    if (!hadImages || !aboutImage) throw err;
    console.error("[pdf-export] a thumbnail broke the render; retrying without thumbnails", err);
    return renderProgramPdf(withThumbs(withImages, () => null), lang);
  }
}

/** Filesystem-safe slug (handles Turkish letters via NFKD → ASCII). */
export function slugify(s: string): string {
  const out = (s || "")
    .toLowerCase()
    .replace(/ı/g, "i") // dotless ı has no NFKD decomposition
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
