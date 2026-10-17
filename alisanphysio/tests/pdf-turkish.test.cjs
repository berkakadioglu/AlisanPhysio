/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const zlib = require("node:zlib");
const Module = require("node:module");

// The PDF fonts are read relative to the app root (as in the deployed function).
process.chdir(path.join(__dirname, ".."));

const build = require("../src/lib/pdf/build.ts");
const delivery = require("../src/lib/pdf/delivery.ts");
const protocol = require("../src/lib/pdf-export-protocol.ts");
const { t } = require("../src/lib/i18n.ts");

const TITLE = "Şubat 2027 – Kalça & Omurga İyileştirme";
const TOKEN = "a1b2c3d4e5f60718";
const PROGRAM = "11111111-1111-4111-8111-111111111111";
const LIB = "lib-1";

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

/**
 * Every code point the ToUnicode CMaps map a glyph to. Only destinations count:
 * bfchar pairs, bfrange arrays, and plain bfrange triples. (The source side is
 * glyph ids, which can look like code points.) Tokens stay on their line.
 */
function mappedCodes(buf) {
  const codes = new Set();
  for (const cmap of toUnicodeMaps(buf)) {
    for (const [, block] of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const [, dst] of block.matchAll(/<[0-9a-fA-F]+>[ \t]*<([0-9a-fA-F]+)>/g)) codes.add(dst.toUpperCase());
    }
    for (const [, block] of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const [, array] of block.matchAll(/\[([^\]]*)\]/g)) {
        for (const [, dst] of array.matchAll(/<([0-9a-fA-F]+)>/g)) codes.add(dst.toUpperCase());
      }
      const plain = block.replace(/\[[^\]]*\]/g, "");
      for (const [, dst] of plain.matchAll(/<[0-9a-fA-F]+>[ \t]+<[0-9a-fA-F]+>[ \t]+<([0-9a-fA-F]+)>/g)) {
        codes.add(dst.toUpperCase());
      }
    }
  }
  return codes;
}

/** True when some glyph in the PDF's text layer maps to this code point (hex, any case). */
function mapsTo(buf, hex) {
  return mappedCodes(buf).has(hex.toUpperCase());
}

/** Load an export route with requireStaff() returning `db`. A fresh module per database. */
function loadRoute(file, db) {
  const original = Module._load;
  Module._load = function (request, parent, main) {
    if (request === "@/lib/admin-auth") return { requireStaff: async () => ({ supabase: db }) };
    return original.call(this, request, parent, main);
  };
  try {
    const route = path.join(__dirname, "..", "src", "app", "admin", "export", ...file.split("/"));
    delete require.cache[require.resolve(route)];
    return require(route);
  } finally {
    Module._load = original;
  }
}

test("file names: an ASCII fallback plus a readable Unicode slug, for Turkish and English", () => {
  for (const lang of ["tr", "en"]) {
    const names = build.pdfFileName(TITLE, lang);
    assert.match(names.ascii, /^alisanphysio-[a-z0-9-]+-(tr|en)\.pdf$/);
    assert.match(names.ascii, new RegExp(`-${lang}\\.pdf$`));
    assert.match(names.unicode, /^alisanphysio-[\p{L}\p{N}-]+-(tr|en)\.pdf$/u);
  }
  assert.equal(build.pdfFileName(TITLE, "tr").ascii, "alisanphysio-subat-2027-kalca-omurga-iyilestirme-tr.pdf");
  assert.equal(build.pdfFileName(TITLE, "tr").unicode, "alisanphysio-şubat-2027-kalça-omurga-iyileştirme-tr.pdf");
  assert.equal(build.pdfFileName(TITLE, "en").unicode, "alisanphysio-şubat-2027-kalça-omurga-iyileştirme-en.pdf");

  // Turkish casing: dotted capital İ becomes i, while dotless ı, ğ and ş are kept.
  assert.equal(build.slugifyUnicode("Işıl Ağrı Dağ – İyi", "tr"), "ışıl-ağrı-dağ-iyi");

  // An empty or symbol-only title falls back to "program".
  assert.equal(build.pdfFileName("", "tr").unicode, "alisanphysio-program-tr.pdf");
  assert.equal(build.pdfFileName(" – & ", "en").ascii, "alisanphysio-program-en.pdf");
  assert.equal(build.pdfFileName(" – & ", "en").unicode, "alisanphysio-program-en.pdf");

  // Capped at 60 code points, and a cut never leaves a trailing hyphen.
  assert.equal([...build.slugifyUnicode("ş".repeat(80), "tr")].length, 60);
  assert.equal(build.slugifyUnicode(`${"a".repeat(59)} bcd`, "en"), "a".repeat(59));
});

test("Content-Disposition: the ASCII fallback plus the real UTF-8 name, always a valid header", () => {
  const names = build.pdfFileName(TITLE, "tr");
  const header = delivery.contentDisposition("attachment", names);
  assert.equal(
    header,
    `attachment; filename="alisanphysio-subat-2027-kalca-omurga-iyilestirme-tr.pdf"; filename*=UTF-8''alisanphysio-%C5%9Fubat-2027-kal%C3%A7a-omurga-iyile%C5%9Ftirme-tr.pdf`,
  );
  assert.match(header, /^[\x20-\x7e]+$/, "printable ASCII only");
  assert.equal(protocol.filenameFromDisposition(header), names.unicode);
  assert.doesNotThrow(() => new Headers({ "Content-Disposition": header }));
});

test("Content-Disposition: RFC 5987 encodes ' ( ) * and neutralises characters that could break the header", () => {
  assert.equal(delivery.encodeRfc5987("a'b()*!~"), "a%27b%28%29%2A!~");
  assert.equal(
    delivery.contentDisposition("inline", { ascii: "x.pdf", unicode: "alisanphysio-a'b(c)d*e-tr.pdf" }),
    `inline; filename="x.pdf"; filename*=UTF-8''alisanphysio-a%27b%28c%29d%2Ae-tr.pdf`,
  );
  for (const evil of ['a"b.pdf', "a\r\nSet-Cookie: x=1", "a\\b.pdf", "a\u0000b", 'new\nline"quote\\back/slash', "\u0001"]) {
    const header = delivery.contentDisposition("attachment", { ascii: evil, unicode: evil });
    assert.match(header, /^[\x20-\x7e]+$/, `printable for ${JSON.stringify(evil)}`);
    assert.equal(header.split('"').length, 3, `one quoted filename for ${JSON.stringify(evil)}`);
    assert.doesNotThrow(() => new Headers({ "Content-Disposition": header }));
  }
});

test("Content-Disposition: a plain string gives the same header as before", () => {
  assert.equal(
    delivery.contentDisposition("inline", "alisanphysio-october-2026-en.pdf"),
    `inline; filename="alisanphysio-october-2026-en.pdf"; filename*=UTF-8''alisanphysio-october-2026-en.pdf`,
  );
  assert.equal(delivery.contentDisposition("attachment", 'a"b.pdf'), `attachment; filename="ab.pdf"; filename*=UTF-8''ab.pdf`);
  assert.equal(delivery.contentDisposition("attachment", ""), `attachment; filename="document.pdf"; filename*=UTF-8''document.pdf`);
});

// ---- Editor export (POST) ----------------------------------------------------

/** A fake database that answers the editor export's exercise_library lookup. */
function libraryDb() {
  return {
    from(table) {
      const q = {
        select() { return q; },
        in() { return q; },
        async returns() {
          return { data: table === "exercise_library" ? [{ id: LIB, youtube_url: null }] : [], error: null };
        },
      };
      return q;
    },
  };
}

async function postExport(body) {
  const { POST } = loadRoute("program/route.ts", libraryDb());
  return POST(
    new Request("http://localhost/admin/export/program", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const EDITOR_BODY = {
  lang: "tr",
  title: "Şubat 2027",
  clientName: "Ayşe Işıl Öztürk-Çağlayan",
  monthStart: "2027-02-01",
  notes: null,
  days: [
    {
      title: "Gün 1",
      exercises: [
        { name: "Kalça açılımı", sets: 2, reps: "10", instructions: "Yavaş yapın.", media_url: null, library_id: null },
        { name: "Squat", sets: 3, reps: "8-10", instructions: null, media_url: null, library_id: LIB },
      ],
    },
  ],
};

test("editor export (tr): the Turkish title reaches the file name, and the PDF carries the Turkish glyphs", async () => {
  const res = await postExport(EDITOR_BODY);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  const header = res.headers.get("content-disposition");
  assert.equal(
    header,
    `attachment; filename="alisanphysio-subat-2027-tr.pdf"; filename*=UTF-8''alisanphysio-%C5%9Fubat-2027-tr.pdf`,
  );
  assert.equal(protocol.filenameFromDisposition(header), "alisanphysio-şubat-2027-tr.pdf");

  const pdf = Buffer.from(await res.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  // Ş (Şubat), ı (Işıl, açılımı), ş (Ayşe), ğ (Çağlayan), ç (Kalça), Ö (Öztürk).
  for (const hex of ["015E", "0131", "015F", "011F", "00E7", "00D6"]) {
    assert.ok(mapsTo(pdf, hex), `a glyph maps to U+${hex}`);
  }
});

test("editor export (en): no Turkish month name, so no Ş in the PDF", async () => {
  const res = await postExport({ ...EDITOR_BODY, lang: "en", title: "February 2027" });
  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get("content-disposition"),
    `attachment; filename="alisanphysio-february-2027-en.pdf"; filename*=UTF-8''alisanphysio-february-2027-en.pdf`,
  );
  const pdf = Buffer.from(await res.arrayBuffer());
  // The client's name is in the PDF too (its Ö is mapped), so the CMaps were read.
  assert.ok(mapsTo(pdf, "00D6"), "the CMaps were read (Öztürk)");
  assert.equal(mapsTo(pdf, "015E"), false, "no Ş when exporting in English");
});

test("editor export with no title: the fallback is in the export language, not the viewer's", async () => {
  assert.equal(t("tr", "ed.fallback.programme"), "Program");
  assert.equal(t("tr", "ed.fallback.savedDay"), "Kayıtlı gün");
  const days = [{ title: "", exercises: [{ name: "Wall slides", sets: 2, reps: "10" }] }];
  const cases = [
    [{ lang: "tr" }, "alisanphysio-program-tr.pdf"],
    [{ lang: "tr", kind: "template" }, "alisanphysio-kayıtlı-gün-tr.pdf"],
    [{ lang: "en" }, "alisanphysio-programme-en.pdf"],
    [{ lang: "en", kind: "template" }, "alisanphysio-saved-day-en.pdf"],
  ];
  for (const [over, expected] of cases) {
    const res = await postExport({ title: "   ", days, ...over });
    assert.equal(res.status, 200, JSON.stringify(over));
    assert.equal(protocol.filenameFromDisposition(res.headers.get("content-disposition")), expected, JSON.stringify(over));
  }
});

// ---- Saved programme download (GET) ------------------------------------------

test("saved programme download (tr): an ASCII header, the name in filename*, and the result cookie", async () => {
  const db = {
    from(table) {
      const q = {
        select() { return q; },
        eq() { return q; },
        order() { return q; },
        async maybeSingle() {
          if (table === "programs")
            return {
              data: { id: PROGRAM, kind: "client", client_id: "c1", title: "Ekim 2026 – İtme", month_start_date: "2026-10-01", notes: null },
              error: null,
            };
          return { data: { full_name: "Şevval Işık" }, error: null };
        },
        async returns() {
          if (table === "program_days") return { data: [{ id: "d1", title: "Üst beden", order_index: 0 }], error: null };
          return {
            data: [{ name: "Duvar kaydırma", sets: 1, reps: "8-12", instructions: null, media_url: null, library_id: null, day_id: "d1", order_index: 0, exercise_library: null }],
            error: null,
          };
        },
      };
      return q;
    },
  };
  const { GET } = loadRoute("program/[id]/route.ts", db);
  const res = await GET(
    new Request(`http://localhost/admin/export/program/${PROGRAM}?lang=tr&download=1&token=${TOKEN}`),
    { params: Promise.resolve({ id: PROGRAM }) },
  );
  assert.equal(res.status, 200);
  const header = res.headers.get("content-disposition");
  assert.match(header, /^attachment; /);
  assert.match(header, /^[\x20-\x7e]+$/, "ASCII-only header");
  assert.equal(
    header,
    `attachment; filename="alisanphysio-ekim-2026-itme-tr.pdf"; filename*=UTF-8''alisanphysio-ekim-2026-itme-tr.pdf`,
  );
  assert.equal(protocol.filenameFromDisposition(header), "alisanphysio-ekim-2026-itme-tr.pdf");
  assert.equal(res.headers.get("set-cookie"), `pdf-export-${TOKEN}=ok; Path=/; Max-Age=120; SameSite=Lax`);
  // The client's name is Turkish too: its Ş reaches the PDF's text layer.
  assert.ok(mapsTo(Buffer.from(await res.arrayBuffer()), "015E"), "the client name's Ş is copyable");
});
