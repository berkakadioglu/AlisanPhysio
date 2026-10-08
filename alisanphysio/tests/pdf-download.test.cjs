/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

// The PDF fonts are read relative to the app root (as in the deployed function).
process.chdir(path.join(__dirname, ".."));

const protocol = require("../src/lib/pdf-export-protocol.ts");
const delivery = require("../src/lib/pdf/delivery.ts");

const PROGRAM = "11111111-1111-4111-8111-111111111111";
const TOKEN = "a1b2c3d4e5f60718";

/** Load an export route with requireStaff() resolving to `db`. */
function loadRoute(file, db) {
  const original = Module._load;
  Module._load = function (request, parent, main) {
    if (request === "@/lib/admin-auth") return { requireStaff: async () => ({ supabase: db }) };
    return original.call(this, request, parent, main);
  };
  try {
    const route = path.join(__dirname, "..", "src", "app", "admin", "export", ...file.split("/"));
    delete require.cache[require.resolve(route)]; // a fresh module per fake database
    return require(route);
  } finally {
    Module._load = original;
  }
}

/** A saved October programme (no videos, so no network) behind a fake Supabase. */
function programDb(found = true) {
  return {
    from(table) {
      const q = {
        select() { return q; },
        eq() { return q; },
        order() { return q; },
        async maybeSingle() {
          if (table === "programs")
            return { data: found ? { id: PROGRAM, kind: "client", client_id: "c1", title: "October 2026", month_start_date: "2026-10-01", notes: null } : null, error: null };
          return { data: { full_name: "Test Client" }, error: null };
        },
        async returns() {
          if (table === "program_days") return { data: [{ id: "d1", title: "Upper body", order_index: 0 }], error: null };
          return { data: [{ name: "Wall slides", sets: 1, reps: "8-12", instructions: "Goal: control", media_url: null, library_id: null, day_id: "d1", order_index: 0, exercise_library: null }], error: null };
        },
      };
      return q;
    },
  };
}

test("iPad detection: Apple platform + more than one touch point, no user-agent parsing", () => {
  const { isAppleTouchDevice } = protocol;
  assert.equal(isAppleTouchDevice({ platform: "MacIntel", maxTouchPoints: 5 }), true, "iPadOS Safari (reports a Mac)");
  assert.equal(isAppleTouchDevice({ platform: "iPad", maxTouchPoints: 5 }), true);
  assert.equal(isAppleTouchDevice({ platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(isAppleTouchDevice({ platform: "MacIntel", maxTouchPoints: 0 }), false, "desktop Safari");
  assert.equal(isAppleTouchDevice({ platform: "Win32", maxTouchPoints: 10 }), false, "Windows touch laptop");
  assert.equal(isAppleTouchDevice({ platform: "Linux armv8l", maxTouchPoints: 5 }), false, "Android");
  assert.equal(isAppleTouchDevice(undefined), false);
});

test("protocol: tokens, URLs, result cookies and filenames", () => {
  assert.equal(protocol.isExportToken(TOKEN), true);
  for (const bad of ["short", "a".repeat(65), "x;y=1abcdef", "abc def gh", null, 12345678]) assert.equal(protocol.isExportToken(bad), false);
  assert.equal(protocol.savedExportUrl("program", PROGRAM, "tr", TOKEN), `/admin/export/program/${PROGRAM}?lang=tr&download=1&token=${TOKEN}`);
  const name = protocol.exportCookieName(TOKEN);
  assert.equal(protocol.readExportResult(`a=1; ${name}=ok; b=2`, TOKEN), "ok");
  assert.equal(protocol.readExportResult(`${name}=fail`, TOKEN), "fail");
  assert.equal(protocol.readExportResult(`${name}=weird`, TOKEN), null);
  assert.equal(protocol.readExportResult("other=ok", TOKEN), null);
  assert.equal(protocol.filenameFromDisposition(`attachment; filename="a.pdf"; filename*=UTF-8''alisanphysio-ekim-2026-tr.pdf`), "alisanphysio-ekim-2026-tr.pdf");
  assert.equal(protocol.filenameFromDisposition(`inline; filename="alisanphysio-october-2026-en.pdf"`), "alisanphysio-october-2026-en.pdf");
  assert.equal(protocol.filenameFromDisposition(null), null);
});

test("delivery: inline by default, attachment for the button, safe filename header, result cookie", () => {
  const plain = delivery.pdfDelivery(new URL(`https://x.test/admin/export/program/${PROGRAM}?lang=en`));
  assert.deepEqual(plain, { disposition: "inline", token: null, secure: true });
  const button = delivery.pdfDelivery(new URL(`http://localhost/admin/export/program/${PROGRAM}?lang=en&download=1&token=${TOKEN}`));
  assert.deepEqual(button, { disposition: "attachment", token: TOKEN, secure: false });
  assert.equal(delivery.pdfDelivery(new URL("http://l/x?download=1&token=bad;token")).token, null, "a malformed token is ignored");

  assert.equal(delivery.contentDisposition("inline", "alisanphysio-october-2026-en.pdf"),
    `inline; filename="alisanphysio-october-2026-en.pdf"; filename*=UTF-8''alisanphysio-october-2026-en.pdf`);
  assert.doesNotMatch(delivery.contentDisposition("attachment", 'a"b\r\nSet-Cookie: x=1.pdf'), /[\r\n"]b/, "no header injection");

  const ok = delivery.deliverPdf(Buffer.from("%PDF-1.3\n"), "x.pdf", button);
  assert.equal(ok.headers.get("content-type"), "application/pdf");
  assert.equal(ok.headers.get("content-length"), "9");
  assert.match(ok.headers.get("set-cookie"), new RegExp(`^pdf-export-${TOKEN}=ok; Path=/; Max-Age=120; SameSite=Lax$`));
  assert.match(delivery.deliverPdf(Buffer.from("x"), "x.pdf", { ...button, secure: true }).headers.get("set-cookie"), /; Secure$/);
  assert.equal(delivery.deliverPdf(Buffer.from("x"), "x.pdf", plain).headers.get("set-cookie"), null);

  const failed = delivery.deliveryFailure(button, 500, "PDF export failed");
  assert.equal(failed.status, 204, "the button's navigation must leave the page alone");
  assert.match(failed.headers.get("set-cookie"), new RegExp(`^pdf-export-${TOKEN}=fail;`));
  assert.equal(delivery.deliveryFailure(plain, 404, "Not found").status, 404);
});

test("saved programme GET: inline when opened directly, a named attachment for the button, failures report back", async () => {
  const { GET } = loadRoute("program/[id]/route.ts", programDb());
  const get = (query) => GET(new Request(`http://localhost/admin/export/program/${PROGRAM}?${query}`), { params: Promise.resolve({ id: PROGRAM }) });

  const direct = await get("lang=en");
  assert.equal(direct.status, 200);
  assert.equal(direct.headers.get("content-type"), "application/pdf");
  assert.match(direct.headers.get("content-disposition"), /^inline; filename="alisanphysio-october-2026-en\.pdf"/);
  const bytes = Buffer.from(await direct.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(Number(direct.headers.get("content-length")), bytes.length);

  const button = await get(`lang=tr&download=1&token=${TOKEN}`);
  assert.match(button.headers.get("content-disposition"), /^attachment; filename="alisanphysio-october-2026-tr\.pdf"/);
  assert.match(button.headers.get("set-cookie"), new RegExp(`pdf-export-${TOKEN}=ok`));

  const { GET: missing } = loadRoute("program/[id]/route.ts", programDb(false));
  const gone = await missing(new Request(`http://localhost/admin/export/program/${PROGRAM}?download=1&token=${TOKEN}`), { params: Promise.resolve({ id: PROGRAM }) });
  assert.equal(gone.status, 204);
  assert.match(gone.headers.get("set-cookie"), new RegExp(`pdf-export-${TOKEN}=fail`));
  const goneDirect = await missing(new Request(`http://localhost/admin/export/program/${PROGRAM}`), { params: Promise.resolve({ id: PROGRAM }) });
  assert.equal(goneDirect.status, 404);
});

test("session probe: 204 for staff", async () => {
  const { GET } = loadRoute("session/route.ts", {});
  const res = await GET();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("object URLs are revoked later (not in the click's tick) and when the page goes away", async () => {
  const revoked = [];
  const listeners = {};
  const saved = { URL: global.URL, window: global.window };
  global.URL = Object.assign(Object.create(URL), { revokeObjectURL: (u) => revoked.push(u), createObjectURL: () => "blob:x" });
  global.window = { addEventListener: (type, fn) => { listeners[type] = fn; } };
  try {
    const file = require.resolve("../src/lib/pdf-download.ts");
    delete require.cache[file];
    const { revokeLater } = require(file);
    revokeLater("blob:a", 20);
    revokeLater("blob:b", 10_000);
    assert.deepEqual(revoked, [], "nothing is revoked synchronously");
    await new Promise((r) => setTimeout(r, 40));
    assert.deepEqual(revoked, ["blob:a"]);
    listeners.pagehide();
    assert.deepEqual(revoked, ["blob:a", "blob:b"], "leaving the page releases the rest");
  } finally {
    global.URL = saved.URL;
    global.window = saved.window;
  }
});

test("a saved export's result cookie is picked up and cleared; cancel stops polling", async () => {
  const saved = global.document;
  const writes = [];
  let jar = "";
  global.document = {
    get cookie() { return jar; },
    set cookie(value) { writes.push(value); },
  };
  try {
    const file = require.resolve("../src/lib/pdf-download.ts");
    delete require.cache[file];
    const { watchExportResult } = require(file);
    const watch = watchExportResult(TOKEN, { intervalMs: 5, timeoutMs: 2000 });
    setTimeout(() => { jar = `x=1; pdf-export-${TOKEN}=fail`; }, 20);
    assert.equal(await watch.promise, "fail");
    assert.match(writes[0], new RegExp(`^pdf-export-${TOKEN}=; Max-Age=0; Path=/$`));

    jar = "";
    assert.equal(await watchExportResult("zzzzzzzzzz", { intervalMs: 5, timeoutMs: 15 }).promise, "timeout");

    const cancelled = watchExportResult("yyyyyyyyyy", { intervalMs: 5, timeoutMs: 15 });
    cancelled.cancel();
    const outcome = await Promise.race([cancelled.promise, new Promise((r) => setTimeout(() => r("still pending"), 60))]);
    assert.equal(outcome, "still pending");
  } finally {
    global.document = saved;
  }
});

test("the button starts every download inside the tap (no await before it)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/components/program-export-button.tsx"), "utf8");
  const body = (name) => {
    const start = src.indexOf(name);
    assert.ok(start > 0, `${name} exists`);
    return src.slice(start, src.indexOf("\n  }\n", start));
  };
  assert.doesNotMatch(body("function choose("), /await/);
  const saved = body("function exportSaved(");
  assert.doesNotMatch(saved, /await|fetch\(/, "saved exports navigate, never fetch");
  assert.match(saved, /window\.location\.assign\(savedExportUrl\(/);
  const snapshot = body("async function exportSnapshot(");
  const firstAwait = snapshot.search(/\bawait\s+fetch\(/);
  assert.ok(firstAwait > 0 && snapshot.indexOf("openPendingWindow(") < firstAwait, "the iPad window opens before the first await");
  assert.doesNotMatch(src, /revokeObjectURL/, "no same-tick revoke in the button");
});
