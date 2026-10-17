/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { effectiveVideoId } = require("../src/lib/youtube.ts");
const { loadEditorDays } = require("../src/lib/program-editor-loader.ts");
const {
  asEditorDays,
  initialDays,
  insertDayAtEnd,
  toSaveDays,
  toSaveExercises,
} = require("../src/app/admin/editor/day-ops.ts");
const { fromDayDraft, fromExerciseDraft, toDayDraft } = require("../src/app/admin/editor/drafts.ts");
const { savableExercises, savedDayToEditorDay } = require("../src/lib/saved-days.ts");
const { loadSavedDaysForEditor, loadTemplate } = require("../src/lib/templates.ts");
const build = require("../src/lib/pdf/build.ts");

// A saved day keeps every exercise's library link (library_id) and override
// video (media_url) through save, reopen, insert and PDF export. Made-up ids and
// video ids only.

// Ids must be UUIDs: the app drops any library_id that is not one.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PROGRAM_ID = id(401);
const DAY_ID = id(301);
const T0 = "2026-09-01T08:00:00.000Z";
const T1 = "2026-10-02T00:00:00.000Z";

const LIBRARY = [
  { id: id(101), name: "Goblet squat", youtube_url: "https://www.youtube.com/watch?v=CCCCCCCCCCC" },
  { id: id(102), name: "Hip thrust", youtube_url: "https://youtu.be/DDDDDDDDDDD" },
  { id: id(103), name: "Plank", youtube_url: null },
];
const libraryYoutube = (libraryId) => LIBRARY.find((l) => l.id === libraryId)?.youtube_url ?? null;

// The fixture day and the video each exercise must play:
//   Goblet squat      library link, no override             → the library video
//   Band pull-apart   custom (no library), override         → the override
//   Hip thrust        library link AND override             → the override wins
//   Plank             library link, library has no video    → nothing
const FIXTURE_EXERCISES = [
  { name: "Goblet squat", sets: 3, reps: "8-12", instructions: "Goal: squat\n\n* Brace first", media_url: null, library_id: id(101) },
  { name: "Band pull-apart", sets: 2, reps: "15", instructions: null, media_url: "https://youtu.be/AAAAAAAAAAA", library_id: null },
  { name: "Hip thrust", sets: 3, reps: "10", instructions: "Pause at the top", media_url: "https://www.youtube.com/watch?v=BBBBBBBBBBB", library_id: id(102) },
  { name: "Plank", sets: 2, reps: "30 s", instructions: null, media_url: null, library_id: id(103) },
];
const EXPECTED_VIDEO = {
  "Goblet squat": "CCCCCCCCCCC",
  "Band pull-apart": "AAAAAAAAAAA",
  "Hip thrust": "BBBBBBBBBBB",
  Plank: null,
};
const fields = (e) => ({
  name: e.name, sets: e.sets, reps: e.reps, instructions: e.instructions, media_url: e.media_url, library_id: e.library_id,
});
const FIXTURE_DAY = { title: "Fixture day", sourceTemplateLabel: null, exercises: FIXTURE_EXERCISES.map(fields) };
const PROGRAM_DAYS = [
  { id: DAY_ID, program_id: PROGRAM_ID, title: "Fixture day", order_index: 0, created_at: T0, source_template_label: null },
];
const PROGRAM_EXERCISES = FIXTURE_EXERCISES.map((e, i) => ({
  id: id(201 + i), program_id: PROGRAM_ID, day_id: DAY_ID, order_index: i, ...e,
}));

// ---------------------------------------------------------------------------
// In-memory database. Columns are checked like PostgREST checks them, and a
// select returns only the columns it names, so a column dropped from a loader
// or a write shows up as a missing value. `migrated: false` is the database
// before 0021: the new columns are absent and the new RPC does not exist.
// ---------------------------------------------------------------------------

const COLUMNS = {
  day_templates: { always: ["id", "title", "created_at"], since0021: ["updated_at", "deleted_at", "source_label"] },
  day_template_exercises: {
    always: ["id", "template_id", "name", "sets", "reps", "instructions", "media_url", "library_id", "order_index"],
  },
  program_days: { always: ["id", "program_id", "title", "order_index", "created_at"], since0021: ["source_template_label"] },
  exercises: {
    always: ["id", "program_id", "day_id", "name", "sets", "reps", "instructions", "media_url", "order_index", "library_id"],
  },
  exercise_library: { always: ["id", "name", "youtube_url"] },
};

const pick = (row, cols) => Object.fromEntries(cols.map((c) => [c, row[c] ?? null]));
const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

// "a, b, child(x, y)" → [{ col: "a" }, { col: "b" }, { embed: "child", inner: ["x", "y"] }]
function parseSelect(cols) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of cols) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean).map((p) => {
    const embed = /^(\w+)\((.*)\)$/.exec(p);
    return embed ? { embed: embed[1], inner: embed[2].split(",").map((c) => c.trim()) } : { col: p };
  });
}

function matches(row, filters) {
  return filters.every(({ op, col, value }) => {
    const v = row[col] ?? null;
    if (op === "eq" || op === "is") return v === value;
    if (op === "not-is") return v !== value;
    throw new Error(`unsupported filter ${op}`);
  });
}

// Postgres sorts NULL last when ascending and first when descending.
function compare(a, b, orders) {
  for (const { col, ascending } of orders) {
    const x = a[col] ?? null;
    const y = b[col] ?? null;
    if (x === y) continue;
    if (x === null) return ascending ? 1 : -1;
    if (y === null) return ascending ? -1 : 1;
    const c = x < y ? -1 : 1;
    return ascending ? c : -c;
  }
  return 0;
}

function makeDb({ migrated = true } = {}) {
  const log = [];
  let seq = 900;
  const nextId = () => id(++seq);
  const state = {
    day_templates: [],
    day_template_exercises: [],
    program_days: structuredClone(PROGRAM_DAYS),
    exercises: structuredClone(PROGRAM_EXERCISES),
    exercise_library: structuredClone(LIBRARY),
  };

  function columnsOf(table) {
    const { always, since0021 = [] } = COLUMNS[table];
    return migrated ? [...always, ...since0021] : always;
  }
  function schemaError(code, message) {
    return { data: null, error: { code, message } };
  }
  function missingColumn(table, column) {
    return schemaError("42703", `column ${table}.${column} does not exist`);
  }
  function libraryHas(libraryId) {
    return state.exercise_library.some((l) => l.id === libraryId);
  }
  function foreignKeyError() {
    return schemaError("23503", 'insert or update on table "day_template_exercises" violates foreign key constraint');
  }

  // The error PostgREST returns for a select of a column or embed the table lacks.
  function selectError(table, items) {
    for (const item of items) {
      if (item.col) {
        if (!columnsOf(table).includes(item.col)) return missingColumn(table, item.col);
      } else if (table === "day_templates" && item.embed === "day_template_exercises") {
        const bad = item.inner.find((c) => c !== "count" && !columnsOf("day_template_exercises").includes(c));
        if (bad) return missingColumn("day_template_exercises", bad);
      } else if (table === "day_template_exercises" && item.embed === "exercise_library") {
        const bad = item.inner.find((c) => !columnsOf("exercise_library").includes(c));
        if (bad) return missingColumn("exercise_library", bad);
      } else {
        return schemaError("PGRST200", `unsupported embed ${item.embed} on ${table}`);
      }
    }
    return null;
  }

  function project(row, items) {
    const out = {};
    for (const item of items) {
      if (item.col) {
        out[item.col] = row[item.col] ?? null;
      } else if (item.embed === "day_template_exercises") {
        const children = state.day_template_exercises.filter((c) => c.template_id === row.id);
        out.day_template_exercises = item.inner[0] === "count"
          ? [{ count: children.length }]
          : children.map((c) => pick(c, item.inner));
      } else if (item.embed === "exercise_library") {
        const lib = state.exercise_library.find((l) => l.id === row.library_id);
        out.exercise_library = lib ? pick(lib, item.inner) : null;
      }
    }
    return out;
  }

  function shape(q, projected) {
    return { data: q.single ? (projected[0] ?? null) : projected, error: null };
  }

  // Result of a write: the rows only when the write asked for them with select().
  function finish(q, rows) {
    if (!q.returning) return { data: null, error: null };
    const items = parseSelect(q.returning);
    const err = selectError(q.table, items);
    if (err) return err;
    return shape(q, rows.map((r) => project(r, items)));
  }

  function exec(q) {
    const { table } = q;
    const known = columnsOf(table);
    const badFilter = q.filters.find((f) => !known.includes(f.col)) ?? q.orders.find((o) => !known.includes(o.col));
    if (badFilter) return missingColumn(table, badFilter.col);
    if (q.payload) {
      const badKey = [].concat(q.payload).flatMap((r) => Object.keys(r)).find((k) => !known.includes(k));
      if (badKey) {
        return schemaError("PGRST204", `Could not find the '${badKey}' column of '${table}' in the schema cache`);
      }
    }

    if (q.op === "insert") {
      const rows = [].concat(q.payload);
      if (table === "day_template_exercises" && rows.some((r) => r.library_id && !libraryHas(r.library_id))) {
        return foreignKeyError();
      }
      const defaults = table === "day_templates" ? { created_at: T1, updated_at: T1, deleted_at: null, source_label: null } : {};
      const created = rows.map((r) => ({ id: nextId(), ...defaults, ...r }));
      state[table].push(...created);
      return finish(q, created);
    }

    const matched = state[table].filter((r) => matches(r, q.filters));
    if (q.op === "update") {
      for (const r of matched) Object.assign(r, q.payload);
      return finish(q, matched);
    }
    if (q.op === "delete") {
      state[table] = state[table].filter((r) => !matched.includes(r));
      if (table === "day_templates") {
        // day_template_exercises cascades with its saved day.
        const gone = new Set(matched.map((r) => r.id));
        state.day_template_exercises = state.day_template_exercises.filter((c) => !gone.has(c.template_id));
      }
      return { data: null, error: null };
    }

    const items = parseSelect(q.cols ?? known.join(", "));
    const err = selectError(table, items);
    if (err) return err;
    const sorted = [...matched].sort((a, b) => compare(a, b, q.orders));
    const page = q.range ? sorted.slice(q.range[0], q.range[1] + 1) : sorted;
    return shape(q, page.map((r) => project(r, items)));
  }

  // Emulates save_day_template (0021) for the create path, the only one the
  // tests use. Like the SQL, it validates everything before it writes anything.
  async function rpc(name, args) {
    log.push({ rpc: name, args });
    if (!migrated) {
      return schemaError("PGRST202", `Could not find the function public.${name}(...) in the schema cache`);
    }
    if (name !== "save_day_template" || args.p_id || args.p_replace_id) {
      return schemaError("TEST_UNSUPPORTED", `${name}: only the create path of save_day_template is emulated`);
    }
    const title = text(args.p_title);
    if (!title || title.length > 300 || args.p_exercises.length === 0) {
      return schemaError("22023", "invalid saved day");
    }
    if (args.p_exercises.some((e) => e.library_id && !libraryHas(e.library_id))) return foreignKeyError();

    const templateId = nextId();
    state.day_templates.push({
      id: templateId,
      title,
      created_at: T1,
      updated_at: T1,
      deleted_at: null,
      source_label: text(args.p_source_label)?.slice(0, 300) ?? null,
    });
    args.p_exercises.forEach((e, i) => {
      state.day_template_exercises.push({
        id: nextId(),
        template_id: templateId,
        name: e.name.trim(),
        sets: e.sets,
        reps: text(e.reps),
        instructions: text(e.instructions),
        media_url: text(e.media_url),
        library_id: e.library_id || null,
        order_index: i,
      });
    });
    return { data: templateId, error: null };
  }

  return {
    log,
    state,
    from(table) {
      if (!COLUMNS[table]) throw new Error(`makeDb has no table ${table}`);
      const q = {
        table, op: "select", cols: null, filters: [], orders: [], range: null, payload: null, returning: null, single: false,
      };
      log.push(q);
      const b = {
        select(cols) {
          if (q.op === "select") q.cols = cols;
          else q.returning = cols;
          return b;
        },
        insert(payload) { q.op = "insert"; q.payload = payload; return b; },
        update(payload) { q.op = "update"; q.payload = payload; return b; },
        delete() { q.op = "delete"; return b; },
        eq(col, value) { q.filters.push({ op: "eq", col, value }); return b; },
        is(col, value) { q.filters.push({ op: "is", col, value }); return b; },
        not(col, op, value) { q.filters.push({ op: `not-${op}`, col, value }); return b; },
        order(col, opts = {}) { q.orders.push({ col, ascending: opts.ascending !== false }); return b; },
        range(from, to) { q.range = [from, to]; return b; },
        returns() { return b; },
        maybeSingle() { q.single = true; return Promise.resolve(exec(q)); },
        single() { q.single = true; return Promise.resolve(exec(q)); },
        then(onOk, onErr) { return Promise.resolve(exec(q)).then(onOk, onErr); },
      };
      return b;
    },
    rpc,
  };
}

// ---------------------------------------------------------------------------
// Server modules. requireStaff hands back the in-memory database. The real
// template actions and the real PDF export route run against it; only the PDF
// renderer is replaced, so the document it would print can be inspected.
// ---------------------------------------------------------------------------

let currentDb = null;
const pdfDocs = [];
async function capturePdf(doc) {
  pdfDocs.push(doc);
  return Buffer.from("%PDF-1.4 fixture\n");
}

const original = Module._load;
Module._load = function (request, parent, main) {
  if (request === "@/lib/admin-auth") return { requireStaff: async () => ({ supabase: currentDb }) };
  if (request === "@/lib/i18n-server") return { getLang: async () => "en" };
  if (request === "next/cache") return { revalidatePath: () => {} };
  if (request === "@/lib/pdf/build") return { ...build, exportProgramPdf: capturePdf };
  return original.call(this, request, parent, main);
};
let actions;
let route;
try {
  actions = require("../src/app/admin/template-actions.ts");
  route = require("../src/app/admin/export/template/[id]/route.ts");
} finally {
  Module._load = original;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Save the programme's fixture day the way the programme editor does.
async function saveFromProgramme(db) {
  currentDb = db;
  const programme = initialDays(asEditorDays(await loadEditorDays(db, PROGRAM_ID, "Other")));
  assert.equal(programme.length, 1, "the fixture programme has one day");
  const day = fromDayDraft(programme[0]);
  const res = await actions.saveDayAsTemplate({
    title: day.title,
    exercises: savableExercises(day.exercises),
    sourceLabel: "Test Client · Oct 2026",
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  const { savedDays, savedDaysFailed } = await loadSavedDaysForEditor(db);
  assert.equal(savedDaysFailed, false);
  const saved = savedDays.find((d) => d.id === res.templateId);
  assert.ok(saved, "the saved day loads back from the database");
  return { res, saved };
}

// Save the fixture day from the saved-day editor and load it back.
async function saveFromSavedDayEditor(db) {
  currentDb = db;
  const [day] = initialDays([FIXTURE_DAY]);
  const res = await actions.saveTemplate({ title: "Fixture saved day", exercises: toSaveExercises(day.exercises) });
  assert.equal(res.ok, true, JSON.stringify(res));
  const saved = await loadTemplate(db, res.templateId);
  assert.ok(saved, "the saved day loads back from the database");
  return saved;
}

// Each exercise keeps every field, and the video it plays is the expected one.
function assertVideosKept(exercises, label) {
  assert.deepEqual(exercises.map(fields), FIXTURE_EXERCISES.map(fields), `${label}: every field is unchanged`);
  for (const e of exercises) {
    assert.equal(
      effectiveVideoId(e.media_url, libraryYoutube(e.library_id)),
      EXPECTED_VIDEO[e.name],
      `${label}: ${e.name} plays the expected video`,
    );
  }
}

// Reopen a saved day, copy it into the editor and insert it into a programme.
// The inserted copy and the programme's own day must both keep every video.
function verifyRoundTrip(saved, label) {
  assertVideosKept(asEditorDays([saved])[0].exercises, `${label}: reopened in the saved-day editor`);

  const draft = toDayDraft(savedDayToEditorDay(saved));
  assertVideosKept(draft.exercises.map(fromExerciseDraft), `${label}: copied into the editor`);

  const { days } = insertDayAtEnd(initialDays([FIXTURE_DAY]), savedDayToEditorDay(saved));
  assert.equal(days.length, 2, `${label}: inserted as a new last day`);
  const [existing, inserted] = toSaveDays(days);
  assertVideosKept(existing.exercises, `${label}: existing programme day untouched`);
  assertVideosKept(inserted.exercises, `${label}: inserted day saved with the programme`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("fixture: each exercise plays the expected video before anything is saved", () => {
  for (const e of FIXTURE_EXERCISES) {
    assert.equal(effectiveVideoId(e.media_url, libraryYoutube(e.library_id)), EXPECTED_VIDEO[e.name], e.name);
  }
});

test("a client programme day keeps every library link and override video through save and insert", async () => {
  const db = makeDb();
  const { res, saved } = await saveFromProgramme(db);
  assert.equal(res.title, "Fixture day");
  assert.equal(db.state.day_template_exercises.length, FIXTURE_EXERCISES.length, "every exercise was stored");
  verifyRoundTrip(saved, "client programme");
});

test("the saved-day editor keeps every library link and override video through save, reopen and insert", async () => {
  const saved = await saveFromSavedDayEditor(makeDb());
  verifyRoundTrip(saved, "saved-day editor");
});

test("before 0021 the legacy save path keeps the same videos in both editors", async () => {
  const programmeDb = makeDb({ migrated: false });
  const { saved } = await saveFromProgramme(programmeDb);
  assert.ok(programmeDb.log.some((q) => q.rpc === "save_day_template"), "the RPC is tried first");
  assert.equal(programmeDb.state.day_template_exercises.length, FIXTURE_EXERCISES.length, "the legacy inserts wrote every exercise");
  verifyRoundTrip(saved, "legacy client programme");

  const reopened = await saveFromSavedDayEditor(makeDb({ migrated: false }));
  verifyRoundTrip(reopened, "legacy saved-day editor");
});

test("the PDF export of a saved day keeps every video, before and after 0021", async () => {
  for (const migrated of [true, false]) {
    const label = migrated ? "after 0021" : "before 0021";
    const db = makeDb({ migrated });
    const { res } = await saveFromProgramme(db);

    const response = await route.GET(
      new Request(`https://admin.test/admin/export/template/${res.templateId}`),
      { params: Promise.resolve({ id: res.templateId }) },
    );
    assert.equal(response.status, 200, label);
    assert.equal(response.headers.get("content-type"), "application/pdf", label);

    const doc = pdfDocs.at(-1);
    assert.equal(doc.title, "Fixture day", label);
    assert.equal(doc.days.length, 1, label);
    assert.deepEqual(
      doc.days[0].exercises.map((e) => [e.name, e.videoId]),
      FIXTURE_EXERCISES.map((e) => [e.name, EXPECTED_VIDEO[e.name]]),
      label,
    );

    // The rows as the route builds them (media_url, library_id, and the library's
    // youtube_url), through build.ts's own mapping and the effective-video rule.
    const raw = db.state.day_template_exercises
      .filter((r) => r.template_id === res.templateId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((r) => ({ ...r, youtube_url: libraryYoutube(r.library_id) }));
    assert.deepEqual(
      build.singleDay(raw)[0].exercises.map((e) => e.videoId),
      doc.days[0].exercises.map((e) => e.videoId),
      `${label}: singleDay maps the same videos`,
    );
    assert.deepEqual(
      raw.map((r) => effectiveVideoId(r.media_url, r.youtube_url)),
      doc.days[0].exercises.map((e) => e.videoId),
      `${label}: effectiveVideoId agrees with the PDF`,
    );
  }
});
