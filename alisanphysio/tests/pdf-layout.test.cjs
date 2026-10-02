/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

// The PDF fonts are read relative to the app root (as in the deployed function).
process.chdir(path.join(__dirname, ".."));

const { Font } = require("@react-pdf/renderer");
const { groupIntoDays } = require("../src/lib/pdf/build.ts");
const { coverLines, doseLabel, renderProgramPdf } = require("../src/lib/pdf/program-pdf.tsx");
const { pdfRichBlocks } = require("../src/lib/pdf/rich.tsx");
const { PDF_BREAK, PDF_CLIENT_NAME_MAX, PDF_TITLE_MAX, breakableParts, clampText, pdfSafe, pdfSafeInline, preparePdfFonts, textWidth } = require("../src/lib/pdf/pdf-text.ts");
const { registerPdfFonts } = require("../src/lib/pdf/fonts.ts");

const THUMB = `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, "fixtures", "thumb.jpg")).toString("base64")}`;
const pageCount = (buf) => (buf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;

/** Content width of a page and the notes box's inner width (see program-pdf.tsx). */
const CONTENT_WIDTH = 491.28;
const NOTES_WIDTH = CONTENT_WIDTH - 28;
/** The text column beside a thumbnail. */
const TEXT_W = CONTENT_WIDTH - 118 - 14;

/**
 * Advance widths of every text run drawn in the PDF. react-pdf draws each laid
 * out line run as `BT … TJ ET Q` and then moves right by the run's width with
 * `1 0 0 1 <width> 0 cm`, so the widest run is the widest line of text.
 */
function runWidths(buf) {
  const s = buf.toString("latin1");
  const widths = [];
  for (const m of s.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const end = s.indexOf("endstream", start);
    try {
      const text = zlib.inflateSync(buf.subarray(start, end), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString("latin1");
      for (const r of text.matchAll(/ET\s+Q\s+1 0 0 1 ([\d.]+) 0 cm/g)) widths.push(Number(r[1]));
    } catch {
      // not a deflated stream
    }
  }
  return widths;
}

/** Run `fn`, collecting react-pdf's console warnings. */
async function captureWarnings(fn) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = warn;
  }
}

const ex = (over = {}) => ({ name: "Exercise", sets: 3, reps: "8-12", instructions: null, videoId: null, thumb: null, ...over });
const doc = (over = {}) => ({ title: "Programme", notes: null, monthStart: null, clientName: null, days: [{ title: null, exercises: [ex()] }], ...over });

// ---------------------------------------------------------------------------

test("dose pill: singular / plural sets (EN) and no plural after a number (TR)", () => {
  assert.equal(doseLabel({ sets: 1, reps: "8-12" }, "en"), "1 set × 8-12");
  assert.equal(doseLabel({ sets: 3, reps: "8-12 each side" }, "en"), "3 sets × 8-12 each side");
  assert.equal(doseLabel({ sets: 1, reps: null }, "en"), "1 set");
  assert.equal(doseLabel({ sets: 2, reps: "  " }, "en"), "2 sets");
  assert.equal(doseLabel({ sets: 1, reps: "8-12" }, "tr"), "1 set × 8-12");
  assert.equal(doseLabel({ sets: 3, reps: "8-12" }, "tr"), "3 set × 8-12");
  assert.equal(doseLabel({ sets: null, reps: " 45 sec hold " }, "en"), "45 sec hold");
  assert.equal(doseLabel({ sets: null, reps: null }, "en"), null);
});

test("cover: a month-only title is printed once, in the export language", () => {
  const oct = { title: "October 2026", monthStart: "2026-10-01", clientName: null };
  assert.deepEqual(coverLines(oct, "en"), { wordmark: "Train with Alisan", title: "October 2026", month: null, client: null });
  assert.deepEqual(coverLines(oct, "tr"), { wordmark: "Train with Alisan", title: "Ekim 2026", month: null, client: null });
  // A Turkish month title, exported in English (and spacing / case differences).
  assert.equal(coverLines({ ...oct, title: "Ekim 2026" }, "en").title, "October 2026");
  assert.equal(coverLines({ ...oct, title: "Ekim 2026" }, "en").month, null);
  assert.equal(coverLines({ ...oct, title: "  ekim   2026 " }, "tr").month, null);
});

test("cover: a custom title comes first with the month under it; the client line only for client programmes", () => {
  const custom = { title: "Shoulder Rehab Block", monthStart: "2026-10-01", clientName: "Test Sevim" };
  assert.deepEqual(coverLines(custom, "en"), {
    wordmark: "Train with Alisan",
    title: "Shoulder Rehab Block",
    month: "October 2026",
    client: "for Test Sevim",
  });
  assert.equal(coverLines(custom, "tr").month, "Ekim 2026");
  assert.equal(coverLines(custom, "tr").client, "Test Sevim için");
  // A month programme of another month keeps both lines.
  assert.equal(coverLines({ ...custom, title: "November 2026" }, "en").month, "October 2026");
  // Catalogue programmes and templates: no month, no client.
  assert.deepEqual(coverLines({ title: "Hip Mobility", monthStart: null, clientName: null }, "en"), {
    wordmark: "Train with Alisan",
    title: "Hip Mobility",
    month: null,
    client: null,
  });
  assert.equal(coverLines({ ...custom, clientName: "   " }, "en").client, null);
});

test("formatted cues reach the PDF layer: labels, bullets (incl. legacy '* '), marks", async () => {
  registerPdfFonts();
  await preparePdfFonts(); // glyph cleaning needs the loaded faces
  const cues =
    "Goal: Improve cervical strength and stability.\r\n\r\nCues:\r\n\r\n* Keep your head and neck **neutral** throughout.\n* Gently rotate *into* your hand.\n- You can use a towel 💪\n\n1 Set × 8 Reps Each Side — 3–5 sec hold\n\n🔥🔥";
  const blocks = pdfRichBlocks(cues);
  assert.deepEqual(blocks, [
    { type: "paragraph", lines: [{ label: "Goal", inline: [{ type: "text", text: "Improve cervical strength and stability." }] }] },
    { type: "paragraph", lines: [{ label: "Cues", inline: [] }] },
    {
      type: "list",
      items: [
        {
          label: null,
          inline: [
            { type: "text", text: "Keep your head and neck " },
            { type: "bold", children: [{ type: "text", text: "neutral" }] },
            { type: "text", text: " throughout." },
          ],
        },
        {
          label: null,
          inline: [
            { type: "text", text: "Gently rotate " },
            { type: "italic", children: [{ type: "text", text: "into" }] },
            { type: "text", text: " your hand." },
          ],
        },
        // The emoji is dropped and the line's trailing space trimmed.
        { label: null, inline: [{ type: "text", text: "You can use a towel" }] },
      ],
    },
    { type: "paragraph", lines: [{ label: null, inline: [{ type: "text", text: "1 Set × 8 Reps Each Side — 3–5 sec hold" }] }] },
    // "🔥🔥" alone draws nothing, so its paragraph is gone.
  ]);
  // Turkish labels.
  assert.deepEqual(pdfRichBlocks("Hedef: Boyun kaslarını güçlendirmek.")[0].lines[0].label, "Hedef");
  assert.deepEqual(pdfRichBlocks(null), []);
  // The inline cleaner keeps the spaces between marks; pdfSafe (whole strings) trims.
  assert.equal(pdfSafeInline(" text 💪 ", "Inter"), " text  ");
  assert.equal(pdfSafeInline("a\tb c\u0007", "Inter"), "a b c");
  assert.equal(pdfSafe(" text ", "Inter"), "text");

  // …and they render: bold, italic (Inter has no italic face bundled — it must
  // not throw "Could not resolve font … italic"), strike, labels, bullets.
  const formatted = `${cues}\n\n***bold italic*** and ~~struck~~ and *italic*`;
  for (const lang of ["en", "tr"]) {
    const { result: buf, warnings } = await captureWarnings(() =>
      renderProgramPdf(doc({ notes: formatted, days: [{ title: "Day", exercises: [ex({ instructions: formatted, videoId: "LIVJZZyZ2qM", thumb: THUMB })] }] }), lang),
    );
    assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.deepEqual(warnings, []);
  }
});

test("long tokens get invisible break points; ordinary words don't", () => {
  const url = `https://example.com/${"rehab-programme/".repeat(10)}week-${"x".repeat(40)}?utm_source=newsletter&utm_medium=email`;
  assert.ok(url.length > 200);
  const parts = breakableParts(url);
  assert.ok(parts.length > 10, `parts: ${parts.length}`);
  // Nothing added but zero-width break characters: no hyphens, no spaces.
  assert.equal(parts.filter((p) => p !== PDF_BREAK).join(""), url);
  assert.ok(parts.every((p, i) => (i % 2 === 1) === (p === PDF_BREAK)));
  // "﻿" is whitespace to String#trim — that's what makes it a break (glue), not a hyphenation point.
  assert.equal(PDF_BREAK.trim(), "");
  // Never between "//" and every piece fits in the narrowest text column.
  assert.ok(!parts.includes("/"));
  assert.ok(parts.every((p) => textWidth(p, "Inter", 700, 11) < TEXT_W / 2));
  for (const word of ["Strengthening", "güçlendirilmesinden", "kuvvetlendirilemeyenlerden", "hip/knee/ankle", "8-12"])
    assert.deepEqual(breakableParts(word), [word]);
});

test("a 200+ character URL in notes and cues wraps inside its column", async () => {
  const url = `https://example.com/${Array.from({ length: 18 }, (_, i) => `segment${i}abc`).join("/")}?utm_source=newsletter&utm_medium=email`;
  assert.ok(url.length >= 200);
  const day = (exercises) => [{ title: "Day 1", exercises }];
  // Each column separately, so every line can be held to its own column's width.
  const cases = [
    // Notes box.
    { width: NOTES_WIDTH, doc: doc({ notes: `Read this before you start: ${url} — then message me.`, days: day([ex({ name: "A", sets: null, reps: null })]) }) },
    // Cues beside a thumbnail.
    { width: TEXT_W, doc: doc({ days: day([ex({ name: "A", sets: null, reps: null, instructions: `Cues: watch ${url}\n\n- ${url}`, videoId: "LIVJZZyZ2qM", thumb: THUMB })]) }) },
    // Full-width cues and a URL as the exercise name (no video).
    { width: CONTENT_WIDTH, doc: doc({ days: day([ex({ name: url, instructions: `- ${url}` })]) }) },
  ];
  for (const c of cases) {
    const { result: buf, warnings } = await captureWarnings(() => renderProgramPdf(c.doc, "en"));
    assert.deepEqual(warnings.filter((w) => /can't wrap/i.test(w)), []);
    const widths = runWidths(buf);
    assert.ok(widths.length > 0);
    assert.ok(Math.max(...widths) <= c.width + 0.5, `widest line: ${Math.max(...widths)} > ${c.width}`);
  }
  const withUrl = cases[0].doc;

  // Control: without the break points the same URL runs off the page, so the
  // measurement above really detects overflow.
  registerPdfFonts();
  Font.registerHyphenationCallback((word) => [word]);
  try {
    const unbroken = await renderProgramPdf(withUrl, "en");
    assert.ok(Math.max(...runWidths(unbroken)) > CONTENT_WIDTH, "control overflows");
  } finally {
    Font.registerHyphenationCallback(breakableParts);
  }
});

test("the exercise's own video override wins over the library video", () => {
  const days = groupIntoDays(
    [{ id: "d1", title: "Day" }],
    [
      { name: "A", sets: 1, reps: "8", instructions: null, library_id: "l1", day_id: "d1", youtube_url: "https://youtu.be/LIVJZZyZ2qM", media_url: "https://youtube.com/shorts/gpXQwBBzRz0?si=x" },
      { name: "B", sets: 1, reps: "8", instructions: null, library_id: "l2", day_id: "d1", youtube_url: "https://youtu.be/LIVJZZyZ2qM", media_url: null },
      { name: "C", sets: 1, reps: "8", instructions: null, library_id: "l3", day_id: "d1", youtube_url: "https://youtu.be/LIVJZZyZ2qM", media_url: "not a video" },
    ],
  );
  assert.deepEqual(days[0].exercises.map((e) => e.videoId), ["gpXQwBBzRz0", "LIVJZZyZ2qM", "LIVJZZyZ2qM"]);
});

// ---- An October-shaped programme: 2 days × 19 exercises ---------------------
const PARAGRAPH_CUES =
  "Goal: Improve segmental spinal mobility and gently prepare the spine for movement.\n\nCues: Start on hands and knees. Slowly round the spine while gently tucking the pelvis and chin. Reverse the movement by extending through the spine within a comfortable range.";
const BULLET_CUES =
  "Goal: Improve rotator cuff strength and shoulder stability.\n\nCues:\n\n* Keep your elbow bent to 90° and close to your body.\n* Gently press the back of your hand into the wall.\n* Hold for 3–5 seconds, then relax.\n* Keep your shoulder relaxed and do not allow your arm to move.\n- You can use a towel or yoga block\n\n1 Set × 8 Reps Each Side — 3–5 sec hold";
const SHORT_CUES =
  "Strengthen the hamstrings and improve posterior knee stability. Keep the hips stable. Control both the lifting and lowering phases. Avoid using momentum.";
const OCTOBER_NOTES = [
  "Programme Goal",
  "This programme is designed to improve overall strength, mobility and movement control while placing additional focus on neck and shoulder stability.",
  "We will work on cervical control, rotator cuff strength, scapular movement and overhead stability while gradually building upper-body strength. The lower-body sessions focus on hip mobility, knee strength and ankle function.",
  "Perform all exercises slowly and with control. Use a comfortable range of motion and avoid forcing any movement that significantly increases pain. Prioritise good technique over heavier resistance.",
  "Important Routine Note",
  "The neck and shoulder exercises should be performed once daily, including on non-training days.",
  "On gym days, follow the order provided and complete the neck and shoulder routine before your main strength exercises.",
  "On rest or home days, complete the same routine once during the day at home.",
].join("\n\n");

function octoberDoc() {
  const reps = ["8-12", "8-12 each side", "8 reps hold for 3 sec each side", "10"];
  const exercises = Array.from({ length: 38 }, (_, i) => ({
    name: ["Cat-Cow", "Isometric Shoulder External Rotation at Wall", "Leg Curl", "Thoracic Rotation (Quadruped)"][i % 4],
    sets: [1, 1, 2, 3][i % 4],
    reps: reps[i % reps.length],
    instructions: [PARAGRAPH_CUES, BULLET_CUES, SHORT_CUES, PARAGRAPH_CUES][i % 4],
    videoId: "LIVJZZyZ2qM",
    thumb: THUMB,
  }));
  return {
    title: "October 2026",
    notes: OCTOBER_NOTES,
    monthStart: "2026-10-01",
    clientName: "Test Client",
    days: [
      { title: "Upper Body – Neck & Shoulder Control", exercises: exercises.slice(0, 19) },
      { title: "Lower Body + Neck & Shoulder Control", exercises: exercises.slice(19) },
    ],
  };
}

test("an October-shaped programme (38 exercises, formatted cues, long notes) fits in 8 pages (EN + TR)", async () => {
  assert.ok(OCTOBER_NOTES.length > 900, `notes: ${OCTOBER_NOTES.length}`);
  for (const lang of ["en", "tr"]) {
    const { result: buf, warnings } = await captureWarnings(() => renderProgramPdf(octoberDoc(), lang));
    const pages = pageCount(buf);
    // Cover + one page group per day: the previous layout needed 14.
    assert.ok(pages <= 8, `${lang}: ${pages} pages`);
    assert.ok(pages >= 4, `${lang}: ${pages} pages`);
    assert.deepEqual(warnings.filter((w) => /can't wrap/i.test(w)), []);
  }
});

test("the hyphenation callback reuses one Intl.Segmenter and skips short words", () => {
  const Real = Intl.Segmenter;
  let constructed = 0;
  Intl.Segmenter = class extends Real {
    constructor(...args) {
      super(...args);
      constructed++;
    }
  };
  try {
    const url = `https://example.com/${"rehab-programme/".repeat(6)}?utm_source=newsletter`;
    for (let i = 0; i < 500; i++) {
      assert.deepEqual(breakableParts("Strengthening"), ["Strengthening"]);
      assert.deepEqual(breakableParts(" "), [" "]);
      assert.ok(breakableParts(url).length > 1);
    }
    assert.equal(constructed, 0, "no Segmenter built per word");
  } finally {
    Intl.Segmenter = Real;
  }
  // The short-word fast path doesn't change results at the thresholds.
  assert.deepEqual(breakableParts("a".repeat(30)), ["a".repeat(30)]);
  assert.ok(breakableParts("a".repeat(31)).length > 1);
  assert.deepEqual(breakableParts("hip/knee/ankle/shoulder"), ["hip/", PDF_BREAK, "knee/", PDF_BREAK, "ankle/", PDF_BREAK, "shoulder"]);
  assert.deepEqual(breakableParts("💪".repeat(12)), ["💪".repeat(12)], "24 UTF-16 units but 12 graphemes");
});

test("clampText caps by graphemes and marks the cut", () => {
  assert.equal(PDF_TITLE_MAX, 300);
  assert.equal(PDF_CLIENT_NAME_MAX, 200);
  assert.equal(clampText("Shoulder block", 300), "Shoulder block");
  assert.equal(clampText("x".repeat(300), 300), "x".repeat(300));
  const cut = clampText("x".repeat(301), 300);
  assert.equal(cut.length, 300);
  assert.ok(cut.endsWith("…"));
  assert.equal(clampText("Kalça ağrısı için", 8), "Kalça a…");
  assert.equal(clampText("Hip block    and more", 11), "Hip block…", "no space before the ellipsis");
  // Never splits an emoji (two UTF-16 units) or a letter from its combining mark.
  assert.equal(clampText("💪".repeat(10), 5), `${"💪".repeat(4)}…`);
  assert.equal(clampText("💪".repeat(10), 10), "💪".repeat(10));
  assert.equal(clampText("i\u0307".repeat(6), 4), `${"i\u0307".repeat(3)}…`);
});

test("cover: the longest allowed title and client name stay on one cover page, clear of its footer", async () => {
  const content = { title: "Day 1", exercises: [ex()] };
  for (const lang of ["en", "tr"]) {
    const base = await renderProgramPdf(doc({ monthStart: "2026-10-01", clientName: "Test Sevim", days: [content] }), lang);
    assert.equal(pageCount(base), 2);
    for (const title of ["W".repeat(300), "Shoulder rehabilitation programme ".repeat(9), `${"Kalça ".repeat(400)}`]) {
      const { result: buf, warnings } = await captureWarnings(() =>
        renderProgramPdf(doc({ title, monthStart: "2026-10-01", clientName: "Wwwwwwww Mmmmmmmm ".repeat(20), days: [content] }), lang),
      );
      assert.equal(pageCount(buf), 2, `title ${title.slice(0, 12)}…: cover + one content page`);
      assert.deepEqual(warnings.filter((w) => /can't wrap/i.test(w)), []);
    }
  }
});
