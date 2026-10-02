import { Font } from "@react-pdf/renderer";

/**
 * Text hygiene and measurement for the PDF. react-pdf's text engine only breaks
 * lines on "\n" (a lone "\r" glues lines together, U+2028/2029 are dropped),
 * and any character the chosen face can't draw falls through to Helvetica,
 * where it's truncated to its low byte ("💪" prints as "=ª", with zero width).
 */
export type PdfFamily = "Inter" | "Archivo";

/** Upright faces: glyph coverage and text measurement use these. */
const FACES: { fontFamily: PdfFamily; fontWeight: number }[] = [
  { fontFamily: "Inter", fontWeight: 400 },
  { fontFamily: "Inter", fontWeight: 600 },
  { fontFamily: "Inter", fontWeight: 700 },
  { fontFamily: "Archivo", fontWeight: 700 },
  { fontFamily: "Archivo", fontWeight: 800 },
];
/** Inter's italic slots (see fonts.ts). react-pdf loads each registered face
 *  separately, even from the same file, so these are primed as well. */
const ITALIC_FACES = [400, 700].map((fontWeight) => ({
  fontFamily: "Inter" as const,
  fontWeight,
  fontStyle: "italic" as const,
}));

interface GlyphFont {
  unitsPerEm: number;
  hasGlyphForCodePoint(cp: number): boolean;
  glyphForCodePoint(cp: number): { advanceWidth: number };
}

/** react-pdf's per-face source; it caches its load promise, even a failed one. */
interface FontSource {
  data: GlyphFont | null;
  loadResultPromise: Promise<void> | null;
}

const faceKey = (family: PdfFamily, weight: number) => `${family}:${weight}`;
const loaded = new Map<string, GlyphFont>();
let ready: Promise<void> | null = null;

/**
 * Load the brand faces once per process and prime fontkit's glyph cache with
 * the base glyphs that composite letters are built from (Inter draws "i" as
 * dotless ı + U+0307, "ğ" as g + U+0306, …). Without this, pdfkit's subsetter
 * caches those base glyphs with no code points, and every later export from a
 * warm server writes an empty text mapping for "ı" (Turkish copy/search breaks).
 * Never prime the whole font.characterSet: Inter maps alias/private-use code
 * points onto shared glyphs and that would remap ’ and the en dash.
 * Must run after registerPdfFonts().
 */
export function preparePdfFonts(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const prime: number[] = [];
      for (let c = 0x20; c <= 0x7e; c++) prime.push(c);
      prime.push(0x131, 0x237); // dotless i, dotless j
      for (let c = 0x300; c <= 0x36f; c++) prime.push(c); // combining marks
      for (const face of [...FACES, ...ITALIC_FACES]) {
        await Font.load(face);
        const font = (Font.getFont(face) as unknown as FontSource).data;
        if (!font) continue;
        for (const cp of prime)
          if (font.hasGlyphForCodePoint(cp)) font.glyphForCodePoint(cp);
        if (!("fontStyle" in face)) loaded.set(faceKey(face.fontFamily, face.fontWeight), font);
      }
    })().catch((err) => {
      // Let the next export try again: react-pdf would otherwise keep
      // returning the rejected load for the rest of the process.
      // Reset first: getFont itself throws when the family isn't registered.
      loaded.clear();
      ready = null;
      for (const face of [...FACES, ...ITALIC_FACES]) {
        try {
          const source = Font.getFont(face) as unknown as FontSource | null;
          if (source && !source.data) source.loadResultPromise = null;
        } catch {
          // not registered: nothing cached to reset
        }
      }
      throw err;
    });
  }
  return ready;
}

/**
 * Normalise line breaks and whitespace: CR/CRLF, line/paragraph separators,
 * NEL, VT and FF become "\n"; tabs become spaces; other control characters go;
 * trailing spaces and runs of blank lines are collapsed; ends are trimmed.
 */
export function normalizePdfText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/\r\n?|[\p{Zl}\p{Zp}\x85\v\f]/gu, "\n")
    .replace(/\t/g, " ")
    .replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/[ \xA0]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalise `text` for a family. A character the family can't draw in every
 * weight is replaced by a plain equivalent when there is one (unusual spaces →
 * " ", "ﬂ" → "fl", "①" → "1"), otherwise dropped (emoji, dingbats, CJK, …)
 * so it can't print as garbage. Before preparePdfFonts() has run, nothing is
 * changed beyond normalisation.
 */
export function pdfSafe(text: string | null | undefined, family: PdfFamily): string {
  return drawableText(normalizePdfText(text).normalize("NFC"), family);
}

/**
 * pdfSafe for one inline piece of formatted text (a text node between bold /
 * italic marks): the same glyph cleaning, but nothing is trimmed or collapsed —
 * the spaces around "**bold** text" live at the edges of these pieces. Line
 * breaks, tabs and other control characters become a space or go.
 */
export function pdfSafeInline(text: string | null | undefined, family: PdfFamily): string {
  const s = (text ?? "")
    .replace(/[\t\n\v\f\r\x85\p{Zl}\p{Zp}]/gu, " ")
    .replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, "")
    .normalize("NFC");
  return drawableText(s, family);
}

function drawableText(s: string, family: PdfFamily): string {
  const faces = FACES.filter((f) => f.fontFamily === family)
    .map((f) => loaded.get(faceKey(f.fontFamily, f.fontWeight)))
    .filter((f): f is GlyphFont => !!f);
  if (faces.length === 0) return s;
  const drawable = (c: string) => {
    const cp = c.codePointAt(0)!;
    return (cp >= 0x20 && cp <= 0x7e) || faces.every((f) => f.hasGlyphForCodePoint(cp));
  };
  let out = "";
  for (const ch of s) {
    if (ch === "\n" || drawable(ch)) out += ch;
    else if (/\p{Zs}/u.test(ch)) out += " ";
    else {
      const plain = ch.normalize("NFKD");
      if (plain !== ch && [...plain].every(drawable)) out += plain;
    }
  }
  return out;
}

/**
 * Width of `text` in points in the given face (kerning ignored, so it errs a
 * little wide). Before preparePdfFonts() it assumes every character is 1em.
 */
export function textWidth(text: string, family: PdfFamily, weight: number, size: number): number {
  const font = loaded.get(faceKey(family, weight));
  if (!font) return [...text].length * size;
  let units = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    units += font.hasGlyphForCodePoint(cp)
      ? font.glyphForCodePoint(cp).advanceWidth
      : font.unitsPerEm;
  }
  return (units * size) / font.unitsPerEm;
}

/**
 * Lines `text` takes when word-wrapped into `width` points, plus a little slack
 * (react-pdf's line breaker can use more lines than greedy wrapping). A word
 * wider than the line is counted as if it were broken across lines.
 */
export function wrappedLines(
  text: string,
  width: number,
  family: PdfFamily,
  weight: number,
  size: number,
): number {
  const space = textWidth(" ", family, weight, size);
  let total = 0;
  for (const line of text.split("\n")) {
    let lines = 1;
    let used = 0;
    for (const word of line.split(" ")) {
      const w = textWidth(word, family, weight, size);
      if (used > 0 && used + space + w <= width) {
        used += space + w;
        continue;
      }
      if (used > 0) lines++;
      if (w > width) {
        lines += Math.ceil(w / width) - 1;
        used = width;
      } else used = w;
    }
    total += lines;
  }
  return total + Math.floor(total / 8);
}

// ---------------------------------------------------------------------------
// Break opportunities inside very long tokens (pasted links, "aaaa…").
//
// react-pdf's line breaker (@react-pdf/textkit) only breaks between "words",
// i.e. at ASCII spaces, or between the parts a hyphenation callback returns. A
// break at a callback part boundary always draws a "-" (wrong inside a URL),
// and a token wider than the line simply runs off the page. But a part that
// is whitespace to String.prototype.trim becomes a glue node, a break without
// a hyphen. U+FEFF is such a character, and fontkit draws it as a zero-advance
// space (a default-ignorable code point), so it is invisible. Copying the text
// out of the PDF gives a space at those points — only inside these tokens.
// ---------------------------------------------------------------------------

/** Zero-width break opportunity inserted between the parts of a long token. */
export const PDF_BREAK = "﻿";
/** Tokens that look like links get break points from this length… */
const LONG_LINK = 20;
/** …other tokens only from this one (long Turkish words stay intact). */
const LONG_WORD = 30;
/** Longest piece between break points when a token has no separators. */
const MAX_PIECE = 12;
const LINKISH_RE = /[/\\@]|www\.|\.[a-z]{2,}\b/i;
/** Breaks go after a run of these (never between "//" or before "/"). */
const SEPARATORS = new Set([..."/\\?&=#.,;:_-–—|+~@"]);

/** One shared segmenter: the callback runs for every word on every layout pass,
 *  and constructing an Intl.Segmenter per call costs ~40 µs. */
const GRAPHEMES = new Intl.Segmenter("en", { granularity: "grapheme" });

const graphemes = (s: string): string[] => Array.from(GRAPHEMES.segment(s), (g) => g.segment);

// ---------------------------------------------------------------------------
// Length caps for the cover's one-line fields, matching the database: titles
// are limited to 300 characters (saveProgram / save_* RPCs), and no client name
// is anywhere near 200. The editor's POST export takes them from a request
// body, so they're clamped there and again when the document is rendered.
// ---------------------------------------------------------------------------
export const PDF_TITLE_MAX = 300;
export const PDF_CLIENT_NAME_MAX = 200;

/**
 * At most `max` graphemes of `s` (never splits an emoji or a letter with its
 * combining marks); a cut string ends in "…" within the limit.
 */
export function clampText(s: string, max: number): string {
  if (s.length <= max) return s; // UTF-16 length ≥ grapheme count
  const chars = graphemes(s);
  if (chars.length <= max) return s;
  return `${chars.slice(0, Math.max(0, max - 1)).join("").trimEnd()}…`;
}

/**
 * A token split at its break points, with PDF_BREAK parts between the pieces
 * (react-pdf's hyphenation-callback shape). Ordinary words come back whole.
 */
export function breakableParts(word: string): string[] {
  // Fast path for nearly every word: a string's UTF-16 length is never smaller
  // than its grapheme count, so anything this short is below both thresholds.
  if (word.length <= LONG_LINK) return [word];
  const chars = graphemes(word);
  if (chars.length <= (LINKISH_RE.test(word) ? LONG_LINK : LONG_WORD)) return [word];
  const pieces: string[] = [];
  let cur = "";
  let curLength = 0;
  chars.forEach((ch, i) => {
    cur += ch;
    curLength++;
    const next = chars[i + 1];
    const afterSeparators = SEPARATORS.has(ch) && next !== undefined && !SEPARATORS.has(next);
    if (next !== undefined && (afterSeparators || curLength >= MAX_PIECE)) {
      pieces.push(cur);
      cur = "";
      curLength = 0;
    }
  });
  if (cur) pieces.push(cur);
  return pieces.flatMap((p, i) => (i === 0 ? [p] : [PDF_BREAK, p]));
}
