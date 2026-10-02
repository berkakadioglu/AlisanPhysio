/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const zlib = require("node:zlib");

// The PDF fonts are read relative to the app root (as in the deployed function).
process.chdir(path.join(__dirname, ".."));

const { attachThumbnails, exportProgramPdf, groupIntoDays, imageDataUri } = require("../src/lib/pdf/build.ts");
const { renderProgramPdf } = require("../src/lib/pdf/program-pdf.tsx");
const { normalizePdfText, pdfSafe } = require("../src/lib/pdf/pdf-text.ts");
const { t } = require("../src/lib/i18n.ts");

// An original 480×360 JPEG made for this test (no YouTube asset, no network).
const THUMB = fs.readFileSync(path.join(__dirname, "fixtures", "thumb.jpg"));
// Starts and ends like a JPEG but has no frame header: pdfkit throws "Invalid JPEG."
const NO_FRAME_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe2, 0x0f, 0xa2]), Buffer.alloc(4000, 0x41), Buffer.from([0xff, 0xd9])]);

const pageCount = (buf) => (buf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
const watchLinks = (buf) =>
  new Set([...buf.toString("latin1").matchAll(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/g)].map((m) => m[1]));
/** Link annotations to YouTube: one per video thumbnail (the redesign dropped
 *  the separate "Watch on YouTube" caption link under each tile). */
const linkCount = (buf) => (buf.toString("latin1").match(/\/URI \(https:\/\/www\.youtube\.com\/watch\?v=/g) || []).length;

/** Decompressed ToUnicode CMaps (they map glyphs back to text for copy/search). */
function toUnicodeMaps(buf) {
  const s = buf.toString("latin1");
  const maps = [];
  for (const m of s.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const end = s.indexOf("endstream", start);
    try {
      const text = zlib.inflateSync(buf.subarray(start, end), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString("latin1");
      if (text.includes("begincmap")) maps.push(text);
    } catch {
      // not a deflated stream
    }
  }
  return maps;
}

// ---- Fixture: the shape of Alişan's real October programme, scaled up ------
const SHORTS = "79OfOp6RvLM"; // youtube.com/shorts/…?si=…
const SHORTS_MEDIA = "gpXQwBBzRz0"; // shorts link on the exercise itself (media_url)
const YOUTU_BE_SI = "hhQdExaLUuU"; // youtu.be/…?si=…
const WATCH = "-7rtg9INTe8"; // id starting with "-"
const WATCH_PARAMS = "__AsD5K0i3Y"; // id starting with "__", extra query params
const UNREACHABLE = "Unreachab1e"; // thumbnail host refuses the connection
const HANGING = "HangingVid0"; // thumbnail server never answers
const NOT_IMAGE = "NotAnImage0"; // 200 OK with an HTML body
const MISSING = "MissingVid0"; // 404 (what YouTube returns for a deleted video)
const NO_FRAME = "NoFrameJpg0"; // JPEG-looking bytes pdfkit can't embed
const STALLED = "StalledBody"; // headers and a few bytes, then silence
const OVERSIZED = "OversizedV0"; // declares a 10 MB body

// Most exercises have working videos (as in the real programme)…
const WORKING_SOURCES = [
  { youtube_url: `https://youtube.com/shorts/${SHORTS}?si=z1_mOpy8LCo_wyny`, media_url: null },
  { youtube_url: `https://youtu.be/${YOUTU_BE_SI}?si=jgqawji8m9cnFrqe`, media_url: null },
  { youtube_url: `https://www.youtube.com/watch?v=${WATCH}`, media_url: null },
  { youtube_url: `https://www.youtube.com/watch?v=${WATCH_PARAMS}&t=42s`, media_url: null },
  { youtube_url: null, media_url: `https://youtube.com/shorts/${SHORTS_MEDIA}?si=XwG-2d_55t2ZTM9K` },
];
// …and one exercise for each way a video can go wrong.
const SPECIAL_SOURCES = {
  3: { youtube_url: `https://youtu.be/${UNREACHABLE}?si=abc`, media_url: null },
  10: { youtube_url: `https://www.youtube.com/watch?v=${HANGING}`, media_url: null },
  17: { youtube_url: `https://www.youtube.com/watch?v=${NOT_IMAGE}`, media_url: null },
  24: { youtube_url: `https://youtu.be/${MISSING}`, media_url: null },
  31: { youtube_url: `https://www.youtube.com/shorts/${NO_FRAME}`, media_url: null },
  36: { youtube_url: null, media_url: null }, // an exercise with no video
  38: { youtube_url: `https://youtu.be/${STALLED}`, media_url: null },
  40: { youtube_url: `https://youtu.be/${OVERSIZED}`, media_url: null },
};
const OK_IDS = [SHORTS, SHORTS_MEDIA, YOUTU_BE_SI, WATCH, WATCH_PARAMS];
const FAILING_IDS = [UNREACHABLE, HANGING, NOT_IMAGE, MISSING, NO_FRAME, STALLED, OVERSIZED];
const EXERCISES = 48;
const EXERCISES_WITH_VIDEO = EXERCISES - 1; // all but the no-video one

const INSTRUCTIONS =
  "Start on hands and knees with wrists under shoulders – keep the neck long.\r\n" +
  "Rotate slowly through the upper back; breathe out as you open. Avoid forcing the range (20–30°).";
const LONG_INSTRUCTIONS = Array.from(
  { length: 80 },
  (_, i) => `Cue ${i + 1}: move slowly, keep the ribcage down and stop before pain – ağrı olursa durun.`,
).join("\n");

const DAYS = [
  { id: "d1", title: "Upper Body – Neck & Shoulder Control" },
  { id: "d2", title: "Lower Body +Neck Shoulder Control" },
  { id: "d3", title: "Mobilite – Kalça & Omurga (ğüşıöç İ)" },
];

function fixtureExercises() {
  const out = [];
  for (let i = 0; i < EXERCISES; i++) {
    const src = SPECIAL_SOURCES[i] ?? WORKING_SOURCES[i % WORKING_SOURCES.length];
    out.push({
      name: i === 5 ? "Child’s Pose — Kalça Esnetme" : `Exercise ${i + 1} × control`,
      sets: 3,
      reps: i % 4 === 0 ? "45 sec hold" : "10–12",
      instructions: i === 7 ? LONG_INSTRUCTIONS : INSTRUCTIONS,
      library_id: src.youtube_url ? `lib-${i}` : null,
      day_id: DAYS[Math.floor(i / 16)].id,
      ...src,
    });
  }
  return out;
}

// Multi-paragraph coach's note, with Windows line breaks as pasted from a phone.
const NOTES = [
  "Program Goal",
  "This program is designed to improve overall strength, mobility, and movement control while placing additional focus on neck and shoulder stability.",
  "Perform all exercises slowly and with control – avoid forcing any movement that significantly increases pain.",
  "Important Routine Note",
  "The neck and shoulder exercises should be performed once daily, including on non-training days.\r\nOn gym days, complete the routine before your main strength exercises.",
  "Önemli: Boyun ve omuz egzersizlerini her gün bir kez yapın. Ağrı artarsa durun ve Alişan’a haber verin.",
].join("\r\n\r\n");

function fixtureDoc() {
  return {
    title: "October 2026",
    notes: NOTES,
    monthStart: "2026-10-01",
    clientName: "Test Client",
    days: groupIntoDays(DAYS, fixtureExercises()),
  };
}

// ---- A local stand-in for YouTube's thumbnail server ------------------------
let server;
let closedPort;
let inFlight = 0;
let maxInFlight = 0;

before(async () => {
  server = http.createServer((req, res) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    res.on("close", () => inFlight--);
    const id = /\/vi\/([^/]+)\//.exec(req.url)?.[1];
    if (id === HANGING) return; // never answer
    if (id === NOT_IMAGE) return res.writeHead(200, { "content-type": "text/html" }).end("<html>not a thumbnail</html>".repeat(100));
    if (id === MISSING) return res.writeHead(404, { "content-type": "image/jpeg" }).end(Buffer.alloc(1097));
    if (id === NO_FRAME) return res.writeHead(200, { "content-type": "image/jpeg" }).end(NO_FRAME_JPEG);
    if (id === STALLED) return res.writeHead(200, { "content-type": "image/jpeg" }).write(THUMB.subarray(0, 100));
    if (id === OVERSIZED)
      return res.writeHead(200, { "content-type": "image/jpeg", "content-length": "10000000" }).write(THUMB.subarray(0, 100));
    setTimeout(() => res.writeHead(200, { "content-type": "image/jpeg" }).end(THUMB), 20);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  // A port nothing listens on, for the unreachable thumbnail.
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  closedPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const thumbOptions = () => ({
  thumbUrl: (id) =>
    `http://127.0.0.1:${id === UNREACHABLE ? closedPort : server.address().port}/vi/${id}/hqdefault.jpg`,
  timeoutMs: 1_000,
  deadlineMs: 4_000,
  concurrency: 3,
});

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

// ---------------------------------------------------------------------------

test("a long programme with shorts/si links, failing thumbnails and a no-video exercise renders (EN + TR)", async () => {
  // Rendered directly (not via exportProgramPdf's image-free retry), so any
  // render failure fails the test.
  const doc = await attachThumbnails(fixtureDoc(), thumbOptions());
  for (const lang of ["tr", "en"]) {
    const { result: buf, warnings } = await captureWarnings(() => renderProgramPdf(doc, lang));

    assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
    // The old generator's footer line height compounded on every page and made
    // pdfkit throw ("unsupported number: -1.6e+21") once a PDF passed ~10
    // pages — which is why short test programmes always exported fine. (The
    // compact layout fits this fixture in 10 pages; the long-notes test below
    // renders 30+.)
    assert.ok(pageCount(buf) >= 10, `pages: ${pageCount(buf)}`);
    // Every exercise with a video keeps its clickable tile, including the ones
    // whose thumbnail failed (placeholder tile); the no-video one has none.
    assert.deepEqual([...watchLinks(buf)].sort(), [...OK_IDS, ...FAILING_IDS].sort());
    assert.equal(linkCount(buf), EXERCISES_WITH_VIDEO);
    // Nothing was too tall to place, so nothing was clipped off a page.
    assert.deepEqual(warnings.filter((w) => /can't wrap/i.test(w)), []);
  }
});

test("the full export pipeline produces a PDF in reasonable time", async () => {
  const started = performance.now();
  const buf = await exportProgramPdf(fixtureDoc(), "tr", thumbOptions());
  const ms = performance.now() - started;
  assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(pageCount(buf) >= 10, `pages: ${pageCount(buf)}`);
  assert.ok(ms < 20_000, `export took ${Math.round(ms)}ms`);
});

test("thumbnails: failures fall back to null, bounded concurrency, and a hang can't stall the export", async () => {
  const started = performance.now();
  maxInFlight = 0;
  const doc = await attachThumbnails(fixtureDoc(), thumbOptions());
  const elapsed = performance.now() - started;
  const byId = new Map(doc.days.flatMap((d) => d.exercises).filter((e) => e.videoId).map((e) => [e.videoId, e.thumb]));

  for (const id of OK_IDS) assert.match(byId.get(id) ?? "", /^data:image\/jpeg;base64,/, `thumbnail for ${id}`);
  for (const id of FAILING_IDS) assert.equal(byId.get(id), null, `no thumbnail for ${id}`);
  assert.ok(maxInFlight <= 3, `max in flight: ${maxInFlight}`);
  // The hanging and stalled requests are cut off by the per-request timeout (1 s).
  assert.ok(elapsed < 3_000, `thumbnails took ${Math.round(elapsed)}ms`);

  // The overall deadline wins over slow per-request timeouts.
  const deadlineStart = performance.now();
  const hung = await attachThumbnails(fixtureDoc(), { ...thumbOptions(), timeoutMs: 60_000, deadlineMs: 500 });
  assert.ok(performance.now() - deadlineStart < 2_000, "deadline respected");
  assert.equal(hung.days.flatMap((d) => d.exercises).find((e) => e.videoId === HANGING).thumb, null);

  // Oversized images are refused.
  const capped = await attachThumbnails(fixtureDoc(), { ...thumbOptions(), maxBytes: 1_000 });
  assert.ok(capped.days.flatMap((d) => d.exercises).every((e) => e.thumb === null));
});

test("only complete JPEG bytes become thumbnails", () => {
  assert.match(imageDataUri(THUMB), /^data:image\/jpeg;base64,/);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3000)]);
  assert.equal(imageDataUri(png), null, "PNG (pdfkit decodes it, so it's never trusted)");
  assert.equal(imageDataUri(NO_FRAME_JPEG), null, "JPEG without a frame header");
  assert.equal(imageDataUri(THUMB.subarray(0, THUMB.length / 2)), null, "truncated JPEG");
  assert.equal(imageDataUri(Buffer.from("<html>nope</html>".repeat(200))), null, "HTML body");
  assert.equal(imageDataUri(Buffer.alloc(0)), null, "empty body");
});

test("a render failure surfaces as a real Error with a stack", async () => {
  const doc = fixtureDoc();
  const bad = `data:image/jpeg;base64,${NO_FRAME_JPEG.toString("base64")}`;
  const withBadImage = { ...doc, days: [{ ...doc.days[0], exercises: [{ ...doc.days[0].exercises[0], thumb: bad }] }] };
  await assert.rejects(renderProgramPdf(withBadImage, "en"), (err) => err instanceof Error && /Invalid JPEG/.test(err.message));
});

test("a template-sized single day is split across Page elements without losing an exercise", async () => {
  const thumb = `data:image/jpeg;base64,${THUMB.toString("base64")}`;
  const exercises = Array.from({ length: 65 }, (_, i) => ({
    name: `Exercise ${i + 1}`,
    sets: 2,
    reps: "10",
    instructions: INSTRUCTIONS,
    videoId: OK_IDS[i % OK_IDS.length],
    thumb,
  }));
  const doc = { title: "Template", notes: null, monthStart: null, clientName: null, days: [{ title: null, exercises }] };
  const { result: buf, warnings } = await captureWarnings(() => renderProgramPdf(doc, "en"));
  assert.equal(linkCount(buf), exercises.length);
  assert.deepEqual(warnings.filter((w) => /can't wrap/i.test(w)), []);
});

test("very long notes, instructions and day titles flow across pages instead of being clipped", async () => {
  const longNotes = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}: ${INSTRUCTIONS} ${INSTRUCTIONS}`).join("\r\n\r\n");
  const doc = fixtureDoc();
  doc.notes = longNotes;
  doc.days[0].title = "Mobilite – ".repeat(60);
  doc.days[1].exercises[0].instructions = Array.from({ length: 300 }, () => INSTRUCTIONS).join("\n");
  const { result: buf, warnings } = await captureWarnings(() => exportProgramPdf(doc, "tr", thumbOptions()));
  assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
  // The 300-line cues alone fill ~15 pages (29 in all with the tighter layout);
  // clipped into one unbreakable block they'd take one, leaving ~15.
  assert.ok(pageCount(buf) >= 25, `pages: ${pageCount(buf)}`);
  assert.deepEqual(warnings.filter((w) => /can't wrap/i.test(w)), [], "no unbreakable block taller than a page");
});

test("user text is normalised: line breaks, tabs, control characters, unsupported glyphs", async () => {
  assert.equal(normalizePdfText("a\r\nb\rc\u2028d\u2029e\u0085f\vg\fh\ti\u0007j  \n\n\n\nk "), "a\nb\nc\nd\ne\nf\ng\nh ij\n\nk");
  assert.equal(normalizePdfText(null), "");
  // A document renders fine with emoji, separators and "$" patterns, and
  // characters the brand fonts lack are dropped instead of printed as garbage.
  const doc = fixtureDoc();
  doc.title = "Ekim 💪 2026";
  doc.days[0].exercises[0].name = "Squat 💪🔥 – İyi iş\u2028Kalça";
  doc.days[0].exercises[0].reps = "10 $& / $' / $$";
  const buf = await renderProgramPdf(doc, "tr");
  assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(pdfSafe("Squat 💪🔥 – ağrı İ ↗", "Archivo"), "Squat  – ağrı İ ");
  assert.equal(pdfSafe("Squat 💪 – ağrı İ ↗", "Inter"), "Squat  – ağrı İ ↗");
  // A character a face lacks falls back to a plain equivalent where there is one.
  assert.equal(pdfSafe("Week\u2002Plan\u202F1", "Archivo"), "Week Plan 1");
  assert.equal(pdfSafe("Hip \uFB02exion, \uFB01rm core", "Inter"), "Hip flexion, firm core");
  assert.equal(pdfSafe("Day \u2460", "Archivo"), "Day 1");
});

test("interpolated values are inserted literally", () => {
  assert.equal(t("en", "effort.setsReps", { sets: 3, reps: "10 $& / $' / $$" }), "3 sets × 10 $& / $' / $$");
});

test("Turkish text stays copyable on a warm server (no empty ToUnicode entries)", () => {
  // In a fresh process, an export without "ı" used to cache fontkit's base
  // glyphs with no code points, so every later Turkish export mapped "ı" (and
  // other composed letters) to nothing — copy/search broke. Needs its own
  // process: the renders above have already warmed this one.
  const script = `
    require(${JSON.stringify(path.join(__dirname, "load-ts.cjs"))});
    const { renderProgramPdf } = require(${JSON.stringify(path.join(__dirname, "../src/lib/pdf/program-pdf.tsx"))});
    const ex = (name, instructions) => ({ name, sets: 3, reps: "10", instructions, videoId: null, thumb: null });
    const doc = (title, notes, day, name, instructions) =>
      ({ title, notes, monthStart: null, clientName: null, days: [{ title: day, exercises: [ex(name, instructions)] }] });
    (async () => {
      await renderProgramPdf(doc("Mobility", "Keep it light, finish within limits.", "Hips", "Hip circles", "Slow and smooth."), "en");
      const buf = await renderProgramPdf(doc("Kalça", "Ağrı olursa durun, yavaş yapın.", "Isınma", "Kalça açılımı", "Yavaşça ısının."), "tr");
      process.stdout.write(buf.toString("base64"));
    })();
  `;
  const out = execFileSync(process.execPath, ["-e", script], { cwd: path.join(__dirname, ".."), maxBuffer: 64 * 1024 * 1024 });
  const maps = toUnicodeMaps(Buffer.from(out.toString(), "base64"));
  assert.ok(maps.length > 0, "found the ToUnicode maps");
  for (const map of maps) assert.doesNotMatch(map, /<[0-9a-f]+> <>/i);
});

// ---- Export routes (mocked auth + database) --------------------------------
/** Load an export route with requireStaff() returning `db`. */
function loadRoute(file, db) {
  const Module = require("node:module");
  const original = Module._load;
  Module._load = function (request, parent, main) {
    if (request === "@/lib/admin-auth") return { requireStaff: async () => ({ supabase: db }) };
    return original.call(this, request, parent, main);
  };
  try {
    return require(path.join(__dirname, "..", "src", "app", "admin", "export", ...file.split("/")));
  } finally {
    Module._load = original;
  }
}

test("template export: a saved day in Recently deleted is a 404 (and it still works before 0021)", async () => {
  const LIVE = "11111111-1111-4111-8111-111111111111";
  const DELETED = "22222222-2222-4222-8222-222222222222";
  const rows = [
    { id: LIVE, title: "Hip Mobility", deleted_at: null },
    { id: DELETED, title: "Old Day", deleted_at: "2026-09-30T10:00:00Z" },
  ];
  let before0021 = false;
  const queries = [];
  const db = {
    from(table) {
      const filters = [];
      const q = {
        select() { return q; },
        eq(key, value) { filters.push(["eq", key, value]); return q; },
        is(key, value) { filters.push(["is", key, value]); return q; },
        order() { return q; },
        async maybeSingle() {
          queries.push({ table, filters });
          if (before0021 && filters.some((f) => f[1] === "deleted_at"))
            return { data: null, error: { code: "42703", message: "column day_templates.deleted_at does not exist" } };
          const row = rows.find((r) => filters.every(([op, key, value]) => (op === "eq" ? r[key] === value : r[key] === value)));
          return { data: row ? { id: row.id, title: row.title } : null, error: null };
        },
        async returns() {
          return { data: [{ name: "Hip circles", sets: 1, reps: "8-12", instructions: "Goal: *slow*", media_url: null, library_id: null, order_index: 0, exercise_library: null }], error: null };
        },
      };
      return q;
    },
  };
  const { GET } = loadRoute("template/[id]/route.ts", db);
  const get = (id) => GET(new Request(`http://localhost/admin/export/template/${id}?lang=en`), { params: Promise.resolve({ id }) });

  const live = await get(LIVE);
  assert.equal(live.status, 200);
  assert.equal(live.headers.get("content-type"), "application/pdf");
  assert.ok(queries[0].filters.some(([op, key, value]) => op === "is" && key === "deleted_at" && value === null), "live-only filter");

  assert.equal((await get(DELETED)).status, 404);

  const n = queries.length;
  assert.equal((await get("not-a-uuid")).status, 404);
  assert.equal(queries.length, n, "a non-UUID id never reaches the database");

  // Before migration 0021 there is no deleted_at column: fall back, nothing is deleted yet.
  before0021 = true;
  rows[1].deleted_at = undefined;
  const legacy = await get(LIVE);
  assert.equal(legacy.status, 200);
  assert.ok(queries.at(-1).filters.every(([op]) => op === "eq"), "retried without the deleted_at filter");
});

test("editor export: an absurdly long title and client name are capped and the cover stays one page", async () => {
  const db = { from() { throw new Error("no library lookups expected"); } };
  const { POST } = loadRoute("program/route.ts", db);
  const post = (over) =>
    POST(new Request("http://localhost/admin/export/program", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang: "en",
        title: "Shoulder block",
        monthStart: "2026-10-01",
        clientName: "Test Sevim",
        days: [{ title: "Day 1", exercises: [{ name: "Wall slides", sets: 2, reps: "10" }] }],
        ...over,
      }),
    }));
  const short = await post({});
  assert.equal(short.status, 200);
  const shortPages = pageCount(Buffer.from(await short.arrayBuffer()));
  assert.equal(shortPages, 2, "cover + one content page");

  const huge = await post({
    title: `${"Shoulder rehabilitation programme ".repeat(80)}${"W".repeat(2000)}`,
    clientName: "Test Sevim Uzunisimli ".repeat(150),
  });
  assert.equal(huge.status, 200);
  const buf = Buffer.from(await huge.arrayBuffer());
  assert.equal(pageCount(buf), shortPages, "the cover did not spill onto extra pages");
  // The filename is derived from the capped title and stays short.
  assert.match(huge.headers.get("content-disposition"), /filename="alisanphysio-shoulder-rehabilitation-programme-[a-z-]*-en\.pdf"/);
});
