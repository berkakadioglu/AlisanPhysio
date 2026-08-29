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
import { formatWeekRange, t, type Lang } from "@/lib/i18n";
import { registerPdfFonts } from "./fonts";

// ---------------------------------------------------------------------------
// The self-contained document model (already resolved: video ids + thumbnails).
// ---------------------------------------------------------------------------
export interface PdfExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  /** YouTube video id, or null. Drives the clickable watch link. */
  videoId: string | null;
  /** Thumbnail as a data URI, or null if there's no/failed video. */
  thumb: string | null;
}
export interface PdfDay {
  title: string | null;
  exercises: PdfExercise[];
}
export interface ProgramDoc {
  title: string;
  notes: string | null;
  /** ISO Monday for a program week (shows a date range on the cover); null for templates. */
  weekStart: string | null;
  clientName: string | null;
  days: PdfDay[];
}

// ---- Brand palette (print / light — a PDF is always a light document) -------
const C = {
  brand: "#14532D",
  brandBright: "#166534",
  tint: "#E7F0EA",
  text: "#1E293B",
  muted: "#64748B",
  subtle: "#94A3B8",
  border: "#E3E8EF",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  // Cover
  cover: { fontFamily: "Inter", color: C.text, position: "relative" },
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
    fontSize: 20,
    color: C.brand,
    letterSpacing: 0.3,
  },
  coverRule: {
    width: 48,
    height: 3,
    backgroundColor: C.brand,
    borderRadius: 2,
    marginTop: 28,
    marginBottom: 28,
  },
  coverLabel: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: C.subtle,
    fontWeight: 600,
  },
  coverTitle: {
    fontFamily: "Archivo",
    fontWeight: 800,
    fontSize: 30,
    color: C.text,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 1.15,
  },
  coverMeta: { fontSize: 12, color: C.muted, marginTop: 14, textAlign: "center" },
  coverFooter: { position: "absolute", bottom: 44, left: 64, right: 64, alignItems: "center" },
  coverPrepared: { fontSize: 11, color: C.muted },
  coverTagline: { fontSize: 10, color: C.subtle, marginTop: 4 },

  // Content
  page: {
    fontFamily: "Inter",
    fontSize: 10.5,
    color: C.text,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 52,
    lineHeight: 1.4,
  },
  notesBox: {
    backgroundColor: C.tint,
    borderRadius: 8,
    padding: 14,
    marginBottom: 22,
  },
  notesHeading: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.brand,
    marginBottom: 5,
  },
  notesBody: { fontSize: 10.5, color: C.text, lineHeight: 1.5 },

  daySection: { marginBottom: 20 },
  dayHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  },

  exercise: { marginBottom: 12, paddingLeft: 2 },
  exHeaderRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 2 },
  exIndex: {
    fontSize: 9,
    fontWeight: 700,
    color: C.subtle,
    width: 16,
  },
  exName: { fontSize: 12, fontWeight: 700, color: C.text, flexGrow: 1, paddingRight: 8 },
  exEffort: { fontSize: 11, fontWeight: 700, color: C.brandBright },
  exInstructions: { fontSize: 10, color: C.muted, marginLeft: 16, marginTop: 1, lineHeight: 1.45 },

  // Video tile
  tileWrap: { marginLeft: 16, marginTop: 7 },
  tile: {
    position: "relative",
    width: 150,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
  },
  tileImg: { width: 150, height: 84, objectFit: "cover" },
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(20,83,45,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileCaption: { fontSize: 8.5, color: C.brandBright, fontWeight: 600, marginTop: 3 },

  // Footer
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

function effortLine(ex: PdfExercise, lang: Lang): string | null {
  const hasSets = ex.sets != null;
  const hasReps = ex.reps != null && ex.reps.trim() !== "";
  if (hasSets && hasReps)
    return t(lang, "effort.setsReps", { sets: ex.sets as number, reps: (ex.reps as string).trim() });
  if (hasSets) return t(lang, "effort.sets", { sets: ex.sets as number });
  if (hasReps) return (ex.reps as string).trim();
  return null;
}

function VideoTile({ ex, lang }: { ex: PdfExercise; lang: Lang }) {
  if (!ex.videoId || !ex.thumb) return null;
  const url = `https://www.youtube.com/watch?v=${ex.videoId}`;
  return (
    <View style={styles.tileWrap} wrap={false}>
      <Link src={url}>
        <View style={styles.tile}>
          {/* react-pdf Image (not an HTML <img>) — no alt prop exists */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={ex.thumb} style={styles.tileImg} />
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Svg width={13} height={13} viewBox="0 0 24 24">
                <Path d="M8 5v14l11-7z" fill={C.white} />
              </Svg>
            </View>
          </View>
        </View>
      </Link>
      <Link src={url} style={styles.tileCaption}>
        {t(lang, "pdf.watchVideo")} ↗
      </Link>
    </View>
  );
}

function ExerciseBlock({
  ex,
  index,
  lang,
}: {
  ex: PdfExercise;
  index: number;
  lang: Lang;
}) {
  const effort = effortLine(ex, lang);
  return (
    <View style={styles.exercise} wrap={false}>
      <View style={styles.exHeaderRow}>
        <Text style={styles.exIndex}>{index + 1}</Text>
        <Text style={styles.exName}>{ex.name}</Text>
        {effort && <Text style={styles.exEffort}>{effort}</Text>}
      </View>
      {ex.instructions && ex.instructions.trim() !== "" && (
        <Text style={styles.exInstructions}>{ex.instructions.trim()}</Text>
      )}
      <VideoTile ex={ex} lang={lang} />
    </View>
  );
}

function ProgramDocument({ doc, lang }: { doc: ProgramDoc; lang: Lang }) {
  const dateLine = doc.weekStart ? formatWeekRange(doc.weekStart, lang) : null;
  // A single unnamed day (e.g. a template, or a flat program) reads as one plain
  // list — no "Day 1" heading. Multiple days or any named day get headings.
  const showDayHeadings =
    doc.days.length > 1 ||
    doc.days.some((d) => (d.title ?? "").trim() !== "");

  return (
    <Document
      title={doc.title}
      author={PDF_AUTHOR}
      creator={BRAND_NAME}
      producer={BRAND_NAME}
    >
      {/* Cover */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.band} fixed />
        <View style={styles.coverBody}>
          <Text style={styles.wordmark}>{BRAND_NAME}</Text>
          <View style={styles.coverRule} />
          <Text style={styles.coverLabel}>{t(lang, "pdf.program")}</Text>
          <Text style={styles.coverTitle}>{doc.title}</Text>
          {dateLine && <Text style={styles.coverMeta}>{dateLine}</Text>}
          {doc.clientName && <Text style={styles.coverMeta}>{doc.clientName}</Text>}
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverPrepared}>
            {t(lang, "pdf.preparedBy", { name: PDF_AUTHOR })}
          </Text>
          <Text style={styles.coverTagline}>{t(lang, "pdf.tagline")}</Text>
        </View>
        <View style={styles.bandBottom} fixed />
      </Page>

      {/* Content */}
      <Page size="A4" style={styles.page}>
        {doc.notes && doc.notes.trim() !== "" && (
          <View style={styles.notesBox} wrap={false}>
            <Text style={styles.notesHeading}>{t(lang, "prog.notesFrom")}</Text>
            <Text style={styles.notesBody}>{doc.notes.trim()}</Text>
          </View>
        )}

        {doc.days.map((day, di) => (
          <View key={di} style={styles.daySection}>
            {showDayHeadings && (
              <View style={styles.dayHeadingRow} wrap={false}>
                <View style={styles.dayDot} />
                <Text style={styles.dayTitle}>
                  {day.title && day.title.trim() !== ""
                    ? day.title.trim()
                    : t(lang, "prog.day", { n: di + 1 })}
                </Text>
              </View>
            )}
            {day.exercises.map((ex, ei) => (
              <ExerciseBlock key={ei} ex={ex} index={ei} lang={lang} />
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerBrand}>{BRAND_NAME}</Text>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Render a program/template document to a PDF byte buffer. */
export async function renderProgramPdf(
  doc: ProgramDoc,
  lang: Lang,
): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<ProgramDocument doc={doc} lang={lang} />);
}
