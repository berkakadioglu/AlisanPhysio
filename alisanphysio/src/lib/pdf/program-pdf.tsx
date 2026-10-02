import type { ReactNode } from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  Svg,
  Path,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BRAND_NAME, PDF_AUTHOR } from "@/lib/constants";
import { formatMonth, setsEffort, t, type Lang } from "@/lib/i18n";
import { titleIsMonth } from "@/lib/program-detail";
import type { RichBlock } from "@/lib/rich-text";
import { registerPdfFonts } from "./fonts";
import {
  PDF_CLIENT_NAME_MAX,
  PDF_TITLE_MAX,
  clampText,
  pdfSafe,
  preparePdfFonts,
  textWidth,
  wrappedLines,
} from "./pdf-text";
import {
  RichBlocks,
  estBlockHeight,
  estRichHeight,
  flowingBlockParts,
  gapAfter,
  pdfRichBlocks,
  type RichMetrics,
  type RichStyles,
} from "./rich";

// ---------------------------------------------------------------------------
// The self-contained document model (already resolved: video ids + thumbnails).
// ---------------------------------------------------------------------------
export interface PdfExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  /** Coaching cues: the formatting subset of src/lib/rich-text.ts. */
  instructions: string | null;
  /** YouTube video id, or null. Drives the clickable thumbnail. */
  videoId: string | null;
  /** Thumbnail as a data URI, or null if there's no video or the fetch failed
   *  (a video without a thumbnail still gets a clickable placeholder tile). */
  thumb: string | null;
}
export interface PdfDay {
  title: string | null;
  exercises: PdfExercise[];
}
export interface ProgramDoc {
  title: string;
  /** Coach's notes: the formatting subset of src/lib/rich-text.ts. */
  notes: string | null;
  /** First date of the programme month; null for catalogues and templates. */
  monthStart: string | null;
  /** The client a client programme is for; null for catalogues / templates. */
  clientName: string | null;
  days: PdfDay[];
}

// ---- Brand palette (print / light — a PDF is always a light document) -------
const C = {
  brand: "#14532D",
  brandBright: "#166534",
  tint: "#E7F0EA",
  heading: "#0F172A",
  /** Body copy: a dark, readable ink (not a light grey). */
  ink: "#334155",
  muted: "#64748B",
  subtle: "#94A3B8",
  border: "#E3E8EF",
  white: "#FFFFFF",
};

// ---------------------------------------------------------------------------
// Geometry. A4 is 595.28 × 841.89pt; content pages pad 52 at the sides, 48 at
// the top and 56 at the bottom (the footer lives in the bottom padding).
// ---------------------------------------------------------------------------
/** A4 height minus the page's top (48) and bottom (56) padding. */
const CONTENT_HEIGHT = 738;
/** A4 width minus the page's side padding (2 × 52). */
const CONTENT_WIDTH = 491.28;
/** The video thumbnail: about a quarter of the content width, 16:9. */
const THUMB_W = 118;
const THUMB_H = 66.4;
/** Gap between the thumbnail column and the text column. */
const COL_GAP = 14;
/** Text column of an exercise with a video (without one it spans the page). */
const TEXT_W = CONTENT_WIDTH - THUMB_W - COL_GAP;
/** Space above and below each exercise (the divider sits in between). */
const EX_PAD = 6;
/** Exercise number column in the header row. */
const INDEX_W = 17;
/** The dose pill never grows wider than this (its text wraps inside). */
const PILL_MAX = 172;
const PILL_PAD_X = 6;
const NOTES_PAD = 14;
const NOTES_WIDTH = CONTENT_WIDTH - 2 * NOTES_PAD;
const DAY_TITLE_WIDTH = CONTENT_WIDTH - 14; // day dot + gap

const CUES: RichMetrics = { fontSize: 9.5, lineHeight: 1.3, blockGap: 3, itemGap: 1 };
const NOTES: RichMetrics = { fontSize: 9.5, lineHeight: 1.32, blockGap: 4, itemGap: 1.5 };
/** Space between an exercise's header row and its cues. */
const CUES_TOP = 3;

// NOTE — never put `lineHeight` on the content Page style or the fixed footer.
// react-pdf (4.9) re-resolves an inherited *unitless* lineHeight (× fontSize)
// on every pagination pass. Ordinary text keeps its first layout, but the
// footer's page-number <Text render> is re-measured on every page, so its line
// height compounded page after page: the footer slid off the page and, once a
// programme passed ~10 pages, pdfkit threw "unsupported number: -1.6e+21".
// Set lineHeight only on the specific, non-fixed Text styles that need it.
/** Cover line caps: with the month line, the most a cover can hold above its
 *  footer (Archivo 28 pt × 1.15 ≈ 32 pt a line; Inter 13 pt ≈ 16 pt). */
const COVER_TITLE_LINES = 10;
const COVER_CLIENT_LINES = 3;

const styles = StyleSheet.create({
  // Cover
  cover: { fontFamily: "Inter", color: C.heading, position: "relative" },
  band: { height: 8, backgroundColor: C.brand },
  bandBottom: {
    height: 8,
    backgroundColor: C.brand,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  coverBody: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 64,
    paddingVertical: 80,
  },
  wordmark: {
    fontFamily: "Archivo",
    fontWeight: 800,
    fontSize: 34,
    color: C.brand,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  coverRule: {
    width: 56,
    height: 3,
    backgroundColor: C.brand,
    borderRadius: 2,
    marginTop: 30,
    marginBottom: 30,
  },
  coverLabel: {
    fontSize: 10.5,
    letterSpacing: 3,
    color: C.muted,
    fontWeight: 600,
  },
  coverTitle: {
    fontFamily: "Archivo",
    fontWeight: 800,
    fontSize: 28,
    color: C.heading,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 1.15,
    // Even a 300-character title keeps the cover on one page.
    maxLines: COVER_TITLE_LINES,
    textOverflow: "ellipsis",
  },
  coverMonth: { fontSize: 13, color: C.ink, marginTop: 10, textAlign: "center" },
  coverClient: {
    fontSize: 13,
    fontWeight: 600,
    color: C.brand,
    marginTop: 16,
    textAlign: "center",
    maxLines: COVER_CLIENT_LINES,
    textOverflow: "ellipsis",
  },
  coverFooter: { position: "absolute", bottom: 44, left: 64, right: 64, alignItems: "center" },
  coverSignature: { fontFamily: "Archivo", fontWeight: 700, fontSize: 15, color: C.brand },
  coverTagline: { fontSize: 10, color: C.muted, marginTop: 3 },

  // Content (deliberately no lineHeight here — see the note above)
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: C.ink,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 52,
  },
  notesBox: {
    backgroundColor: C.tint,
    borderRadius: 8,
    padding: NOTES_PAD,
    marginBottom: 18,
  },
  notesHeading: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 1,
    color: C.brand,
    marginBottom: 6,
  },
  notesBody: { fontSize: NOTES.fontSize, color: C.ink, lineHeight: NOTES.lineHeight },

  dayHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: C.brand,
    paddingBottom: 6,
  },
  dayDot: {
    width: 6,
    height: 16,
    backgroundColor: C.brand,
    borderRadius: 2,
    marginRight: 8,
  },
  dayTitle: {
    fontFamily: "Archivo",
    fontWeight: 700,
    fontSize: 15,
    color: C.brand,
    flexShrink: 1,
  },

  // Exercise: thumbnail column + text column, a thin divider below
  exercise: { flexDirection: "row", paddingTop: EX_PAD, paddingBottom: EX_PAD },
  divider: { borderBottomWidth: 0.75, borderBottomColor: C.border },
  flowTop: { flexDirection: "row", paddingTop: EX_PAD },
  flowEnd: { height: EX_PAD },
  thumbCol: { width: THUMB_W, marginRight: COL_GAP, flexShrink: 0 },
  textCol: { width: TEXT_W },
  textColFull: { width: CONTENT_WIDTH },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  exIndex: {
    width: INDEX_W,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 700,
    color: C.brand,
    marginTop: 1,
  },
  exName: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontSize: 11,
    fontWeight: 700,
    color: C.heading,
    lineHeight: 1.25,
    paddingRight: 8,
  },
  pill: {
    flexShrink: 0,
    maxWidth: PILL_MAX,
    backgroundColor: C.tint,
    borderRadius: 7,
    paddingHorizontal: PILL_PAD_X,
    paddingTop: 2.5,
    paddingBottom: 2,
  },
  pillText: { fontSize: 8.5, fontWeight: 700, color: C.brand, lineHeight: 1.2 },
  cues: { marginTop: CUES_TOP },
  cuesBody: { fontSize: CUES.fontSize, color: C.ink, lineHeight: CUES.lineHeight },
  label: { fontWeight: 700, color: C.brand },

  // Video tile
  tile: {
    position: "relative",
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 0.75,
    borderColor: C.border,
    borderStyle: "solid",
  },
  tileImg: { width: THUMB_W, height: THUMB_H, objectFit: "cover" },
  tilePlaceholder: { width: THUMB_W, height: THUMB_H, backgroundColor: C.tint },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(20,83,45,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer — fixed + dynamic: must never carry a lineHeight (see the note above)
  footer: {
    position: "absolute",
    bottom: 24,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerBrand: { fontSize: 9, color: C.subtle, fontWeight: 600 },
  footerPage: { fontSize: 9, color: C.subtle },
});

const CUE_STYLES: RichStyles = { body: styles.cuesBody, label: styles.label };
const NOTE_STYLES: RichStyles = { body: styles.notesBody, label: styles.label };

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** The dose pill: "1 set × 8–12", "3 sets × 8–12" (TR "3 set …"), reps alone, or null. */
export function doseLabel(ex: Pick<PdfExercise, "sets" | "reps">, lang: Lang): string | null {
  const reps = ex.reps?.trim() || null;
  if (ex.sets != null) return setsEffort(lang, ex.sets, reps);
  return reps;
}

export interface CoverLines {
  wordmark: string;
  /** The big title: the programme's own title, or its month when that's all it is. */
  title: string;
  /** Month line under a custom title; null when the title already is the month. */
  month: string | null;
  /** "for <client>" on a client programme; null otherwise. */
  client: string | null;
}

/**
 * What the cover prints. A title that only names the month ("October 2026",
 * "Ekim 2026", in either language) is printed once, as the month in the
 * export's language; a custom title gets the month underneath.
 */
export function coverLines(
  doc: Pick<ProgramDoc, "title" | "monthStart" | "clientName">,
  lang: Lang,
): CoverLines {
  const month = doc.monthStart ? formatMonth(doc.monthStart, lang) : null;
  const sameAsMonth = !!doc.monthStart && titleIsMonth(doc.title, doc.monthStart);
  const client = doc.clientName?.trim();
  return {
    wordmark: BRAND_NAME,
    title: sameAsMonth && month ? month : doc.title,
    month: sameAsMonth ? null : month,
    client: client ? t(lang, "pdf.forClient", { name: client }) : null,
  };
}

// ---------------------------------------------------------------------------
// Pagination. In react-pdf a wrap={false} block taller than the page is NOT
// split: it is placed whole and whatever runs past the bottom edge is lost (or
// squeezed until an icon collapses to zero height and pdfkit throws). So a
// block stays unbreakable only when its estimated height — text measured with
// the real fonts and column widths — is at most half a page; anything longer
// flows as page-level parts. minPresenceAhead only works on a node that has an
// earlier sibling on the page, so a day heading is kept with its first
// exercise by grouping them, not by minPresenceAhead.
// ---------------------------------------------------------------------------
/** Blocks estimated taller than this flow across pages instead. */
const ATOMIC_MAX = Math.round(CONTENT_HEIGHT / 2);
/** Room a flowing exercise's top part needs below it (~3 lines of cues). */
const KEEP_AHEAD = 45;
/** A flowing exercise keeps this much of its cues with its header + thumbnail. */
const FLOW_TOP_TEXT = 130;
/** The thumbnail column (tile + its border). */
const THUMB_COL_HEIGHT = THUMB_H + 1.5;
/**
 * Most exercises per content <Page> element. react-pdf re-lays out everything
 * left in a Page at every page break, so time and memory grow much faster than
 * the page count (one 300-exercise Page runs out of memory). One Page per day,
 * with only unusually long days split, keeps it roughly linear.
 */
const EXERCISES_PER_PAGE = 30;

/** An exercise ready to draw: dose, parsed cues and column width resolved. */
interface PreparedExercise {
  ex: PdfExercise;
  index: number;
  dose: string | null;
  cues: RichBlock[];
  textWidth: number;
}

function prepareExercise(ex: PdfExercise, index: number, lang: Lang): PreparedExercise {
  return {
    ex,
    index,
    dose: doseLabel(ex, lang),
    cues: pdfRichBlocks(ex.instructions),
    textWidth: ex.videoId ? TEXT_W : CONTENT_WIDTH,
  };
}

// Height estimates (line heights measured, rounded up).
function estHeaderHeight(p: PreparedExercise): number {
  const nameWidth = p.textWidth - INDEX_W - 8;
  if (!p.dose) return wrappedLines(p.ex.name, nameWidth, "Inter", 700, 11) * 13.75;
  const pillText = Math.min(textWidth(p.dose, "Inter", 700, 8.5), PILL_MAX - 2 * PILL_PAD_X);
  const nameLines = wrappedLines(p.ex.name, nameWidth - pillText - 2 * PILL_PAD_X, "Inter", 700, 11);
  const pillLines = wrappedLines(p.dose, PILL_MAX - 2 * PILL_PAD_X, "Inter", 700, 8.5);
  return Math.max(nameLines * 13.75, pillLines * 10.2 + 4.5);
}

const estCuesHeight = (blocks: RichBlock[], width: number) =>
  blocks.length > 0 ? CUES_TOP + estRichHeight(blocks, width, CUES) : 0;

function estExerciseHeight(p: PreparedExercise): number {
  const text = estHeaderHeight(p) + estCuesHeight(p.cues, p.textWidth);
  return 2 * EX_PAD + 1 + Math.max(text, p.ex.videoId ? THUMB_COL_HEIGHT : 0);
}

const estDayHeadingHeight = (title: string) =>
  wrappedLines(title, DAY_TITLE_WIDTH, "Archivo", 700, 15) * 17 + 10;

/** Locale-aware uppercase (Turkish i → İ), instead of textTransform. */
function upper(s: string, lang: Lang): string {
  return s.toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US");
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A clickable video thumbnail. Without a thumbnail image (fetch failed or
 *  timed out) it still renders, as a branded placeholder that links to the video. */
function ThumbColumn({ ex }: { ex: PdfExercise }) {
  if (!ex.videoId) return null;
  const url = `https://www.youtube.com/watch?v=${ex.videoId}`;
  return (
    <View style={styles.thumbCol}>
      <Link src={url}>
        <View style={styles.tile}>
          {ex.thumb ? (
            // react-pdf Image (not an HTML <img>) — no alt prop exists
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={ex.thumb} style={styles.tileImg} />
          ) : (
            <View style={styles.tilePlaceholder} />
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Svg width={10} height={10} viewBox="0 0 24 24">
                <Path d="M8 5v14l11-7z" fill={C.white} />
              </Svg>
            </View>
          </View>
        </View>
      </Link>
    </View>
  );
}

function ExerciseHeader({ p }: { p: PreparedExercise }) {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.exIndex}>{p.index + 1}</Text>
      <Text style={styles.exName}>{p.ex.name}</Text>
      {p.dose && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{p.dose}</Text>
        </View>
      )}
    </View>
  );
}

function DayHeading({ title }: { title: string }) {
  return (
    <View style={styles.dayHeadingRow}>
      <View style={styles.dayDot} />
      <Text style={styles.dayTitle}>{title}</Text>
    </View>
  );
}

/**
 * One exercise as page-level nodes. A short one is a single unbreakable row
 * (thumbnail | header + cues), prefixed by `heading` (its day heading) so a
 * heading never sits alone at the foot of a page. A long one becomes: an
 * unbreakable top (heading, thumbnail, header and the first cue blocks), kept
 * with a few lines of what follows, then the remaining cue blocks flowing in
 * the text column's indent.
 */
function exerciseParts(
  p: PreparedExercise,
  key: string,
  heading: string | null,
  last: boolean,
): ReactNode[] {
  const headingNode = heading ? <DayHeading title={heading} /> : null;
  const headingHeight = heading ? estDayHeadingHeight(heading) : 0;
  const textColStyle = p.ex.videoId ? styles.textCol : styles.textColFull;

  if (headingHeight + estExerciseHeight(p) <= ATOMIC_MAX) {
    return [
      <View key={key} wrap={false}>
        {headingNode}
        <View style={last ? styles.exercise : [styles.exercise, styles.divider]}>
          <ThumbColumn ex={p.ex} />
          <View style={textColStyle}>
            <ExerciseHeader p={p} />
            {p.cues.length > 0 && (
              <View style={styles.cues}>
                <RichBlocks blocks={p.cues} s={CUE_STYLES} m={CUES} />
              </View>
            )}
          </View>
        </View>
      </View>,
    ];
  }

  // The top keeps whole cue blocks while they fit in FLOW_TOP_TEXT (or beside
  // the thumbnail); the rest flows.
  let topCount = 0;
  let topText = estHeaderHeight(p) + CUES_TOP;
  const topBudget = Math.max(FLOW_TOP_TEXT, p.ex.videoId ? THUMB_COL_HEIGHT : 0);
  for (const block of p.cues) {
    const h =
      (topCount > 0 ? gapAfter(p.cues[topCount - 1], CUES) : 0) +
      estBlockHeight(block, p.textWidth, CUES);
    if (topText + h > topBudget) break;
    topText += h;
    topCount++;
  }
  const top = p.cues.slice(0, topCount);
  const rest = p.cues.slice(topCount);

  const parts: ReactNode[] = [
    <View
      key={`${key}h`}
      wrap={headingHeight + EX_PAD + Math.max(topText, THUMB_COL_HEIGHT) > ATOMIC_MAX}
      minPresenceAhead={rest.length > 0 ? KEEP_AHEAD : 0}
    >
      {headingNode}
      <View style={styles.flowTop}>
        <ThumbColumn ex={p.ex} />
        <View style={textColStyle}>
          <ExerciseHeader p={p} />
          {top.length > 0 && (
            <View style={styles.cues}>
              <RichBlocks blocks={top} s={CUE_STYLES} m={CUES} />
            </View>
          )}
        </View>
      </View>
    </View>,
    ...flowingBlockParts({
      blocks: rest,
      s: CUE_STYLES,
      m: CUES,
      width: p.textWidth,
      atomicMax: ATOMIC_MAX,
      key,
      indent: p.ex.videoId ? THUMB_W + COL_GAP : 0,
      firstGap: true,
      prev: top[top.length - 1],
    }),
    <View key={`${key}e`} style={last ? styles.flowEnd : [styles.flowEnd, styles.divider]} />,
  ];
  return parts;
}

/** Coach's notes: the heading stays with the first block; later blocks are
 *  page-level so long notes flow across pages (the tinted box continues). */
function NotesBox({ blocks, lang }: { blocks: RichBlock[]; lang: Lang }) {
  const [first, ...rest] = blocks;
  const firstHeight = 30 + estBlockHeight(first, NOTES_WIDTH, NOTES);
  return (
    <View style={styles.notesBox}>
      <View wrap={firstHeight > ATOMIC_MAX}>
        <Text style={styles.notesHeading}>{upper(t(lang, "pdf.notesFrom"), lang)}</Text>
        <RichBlocks blocks={[first]} s={NOTE_STYLES} m={NOTES} />
      </View>
      {flowingBlockParts({
        blocks: rest,
        s: NOTE_STYLES,
        m: NOTES,
        width: NOTES_WIDTH,
        atomicMax: ATOMIC_MAX,
        key: "n",
        firstGap: true,
        prev: first,
      })}
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerBrand}>{BRAND_NAME}</Text>
      <Text
        style={styles.footerPage}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

/** The exercises of one content <Page> element: a day, or a slice of a long one. */
interface PageChunk {
  /** Day heading, on the first chunk of a day when headings are shown. */
  heading: string | null;
  exercises: PdfExercise[];
  /** Index of the first exercise within its day (numbering continues). */
  offset: number;
  /** The day's last chunk (its last exercise gets no divider). */
  endsDay: boolean;
}

function pageChunks(doc: ProgramDoc, lang: Lang): PageChunk[] {
  // A single unnamed day (e.g. a template, or a flat program) reads as one plain
  // list — no "Day 1" heading. Multiple days or any named day get headings.
  const showHeadings = doc.days.length > 1 || doc.days.some((d) => !!d.title);
  return doc.days.flatMap((day, di) => {
    const title = day.title || t(lang, "prog.day", { n: di + 1 });
    const chunks: PageChunk[] = [];
    for (let i = 0; i < day.exercises.length; i += EXERCISES_PER_PAGE) {
      chunks.push({
        heading: showHeadings && i === 0 ? title : null,
        exercises: day.exercises.slice(i, i + EXERCISES_PER_PAGE),
        offset: i,
        endsDay: i + EXERCISES_PER_PAGE >= day.exercises.length,
      });
    }
    return chunks;
  });
}

function ProgramDocument({ doc, lang }: { doc: ProgramDoc; lang: Lang }) {
  const cover = coverLines(doc, lang);
  const notes = pdfRichBlocks(doc.notes);
  const chunks = pageChunks(doc, lang);
  // Always at least one content page (notes only, or even empty).
  const pages: (PageChunk | null)[] = chunks.length > 0 ? chunks : [null];

  return (
    <Document
      title={cover.title}
      author={PDF_AUTHOR}
      creator={BRAND_NAME}
      producer={BRAND_NAME}
    >
      {/* Cover */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.band} fixed />
        <View style={styles.coverBody}>
          <Text style={styles.wordmark}>{cover.wordmark}</Text>
          <View style={styles.coverRule} />
          <Text style={styles.coverLabel}>{upper(t(lang, "pdf.program"), lang)}</Text>
          <Text style={styles.coverTitle}>{cover.title}</Text>
          {cover.month && <Text style={styles.coverMonth}>{cover.month}</Text>}
          {cover.client && <Text style={styles.coverClient}>{cover.client}</Text>}
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverSignature}>{PDF_AUTHOR}</Text>
          <Text style={styles.coverTagline}>{t(lang, "pdf.tagline")}</Text>
        </View>
        <View style={styles.bandBottom} fixed />
      </Page>

      {/* Content — each day starts on a fresh page */}
      {pages.map((chunk, pi) => (
        <Page key={pi} size="A4" style={styles.page}>
          {pi === 0 && notes.length > 0 && <NotesBox blocks={notes} lang={lang} />}
          {chunk?.exercises.flatMap((ex, i) =>
            exerciseParts(
              prepareExercise(ex, chunk.offset + i, lang),
              String(i),
              i === 0 ? chunk.heading : null,
              chunk.endsDay && i === chunk.exercises.length - 1,
            ),
          )}
          <Footer />
        </Page>
      ))}
    </Document>
  );
}

/** Clean every user-entered plain string for the face that will draw it.
 *  Notes and cues are formatted text: they're parsed first and cleaned per
 *  text node (pdfRichBlocks), so they pass through untouched here. */
function sanitizeDoc(doc: ProgramDoc): ProgramDoc {
  const inter = (s: string | null) => pdfSafe(s, "Inter") || null;
  return {
    ...doc,
    title: clampText(pdfSafe(doc.title, "Archivo"), PDF_TITLE_MAX) || "Program",
    clientName: clampText(pdfSafe(doc.clientName, "Inter"), PDF_CLIENT_NAME_MAX) || null,
    days: doc.days.map((day) => ({
      title: pdfSafe(day.title, "Archivo") || null,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        name: pdfSafe(ex.name, "Inter"),
        reps: inter(ex.reps),
      })),
    })),
  };
}

/** Render a program/template document to a PDF byte buffer. */
export async function renderProgramPdf(
  doc: ProgramDoc,
  lang: Lang,
): Promise<Buffer> {
  registerPdfFonts();
  await preparePdfFonts();
  try {
    return await renderToBuffer(<ProgramDocument doc={sanitizeDoc(doc)} lang={lang} />);
  } catch (err) {
    // pdfkit throws bare strings (e.g. "Invalid JPEG."), which log with no stack.
    throw err instanceof Error ? err : new Error(`PDF render failed: ${String(err)}`);
  }
}
