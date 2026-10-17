/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const sync = require("../src/lib/library-sync.ts");
const { t } = require("../src/lib/i18n.ts");

// Made-up ids and video ids only.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const V = "dQw4w9WgXcQ";
const W = "SCVCLChPQFY";
const url = (v) => `https://www.youtube.com/watch?v=${v}`;
const NO_VIDEO = { default_instructions: null, youtube_url: null };

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("an empty row never differs on cues, so it never wipes the library's cues", () => {
  const entry = { default_instructions: "Goal: hold\n* Keep ribs down", youtube_url: null };
  for (const instructions of [null, "", "  \n\t "]) {
    assert.deepEqual(sync.libraryDiff({ instructions, media_url: null }, entry), { cues: false, video: false });
  }
});

test("line-ending and surrounding-whitespace differences alone are not a change", () => {
  const entry = { default_instructions: "Goal: hold\n* Keep ribs down", youtube_url: null };
  const cues = (instructions, library = entry.default_instructions) =>
    sync.libraryDiff({ instructions, media_url: null }, { default_instructions: library, youtube_url: null }).cues;
  assert.equal(cues("Goal: hold\r\n* Keep ribs down\r\n"), false);
  assert.equal(cues("  Goal: hold\n* Keep ribs down  "), false);
  assert.equal(cues("Goal: hold\n* Keep ribs down", "Goal: hold\r\n* Keep ribs down\r\n"), false);
  assert.equal(cues("Goal: hold\n* Keep ribs down\n* Breathe"), true, "a real new cue is a change");
  assert.equal(cues("Hold it", null), true, "cues where the library has none are a change");
});

test("the same YouTube video in another URL form is not a change", () => {
  const entry = { default_instructions: null, youtube_url: url(V) };
  assert.equal(sync.libraryDiff({ instructions: null, media_url: `https://youtu.be/${V}?si=abc` }, entry).video, false);
  assert.equal(sync.libraryDiff({ instructions: null, media_url: `https://youtube.com/shorts/${V}` }, entry).video, false);
  assert.equal(
    sync.libraryDiff({ instructions: null, media_url: `https://youtu.be/${V}` }, { default_instructions: null, youtube_url: `https://youtu.be/${V}` }).video,
    false,
  );
});

test("a different video, or the first video for an entry without one, is a change", () => {
  assert.equal(sync.libraryDiff({ instructions: null, media_url: url(W) }, { default_instructions: null, youtube_url: url(V) }).video, true);
  assert.equal(sync.libraryDiff({ instructions: null, media_url: url(V) }, NO_VIDEO).video, true);
});

test("a non-YouTube link never goes to the library, whatever the entry holds", () => {
  assert.equal(sync.libraryDiff({ instructions: null, media_url: "https://vimeo.com/76979871" }, NO_VIDEO).video, false);
  assert.equal(sync.libraryDiff({ instructions: null, media_url: "https://example.com/demo.mp4" }, { default_instructions: null, youtube_url: url(V) }).video, false);
  assert.equal(sync.libraryDiff({ instructions: null, media_url: "not a link" }, NO_VIDEO).video, false);
});

test("hasLibraryDiff reports whether either field differs", () => {
  assert.equal(sync.hasLibraryDiff({ cues: false, video: false }), false);
  assert.equal(sync.hasLibraryDiff({ cues: true, video: false }), true);
  assert.equal(sync.hasLibraryDiff({ cues: false, video: true }), true);
});

test("countShownLibraryVideo counts programmes that show the library video, once each", () => {
  assert.equal(
    sync.countShownLibraryVideo([
      { owner: "p1", media_url: null },
      { owner: "p1", media_url: null }, // the same programme twice counts once
      { owner: "p2", media_url: url(W) }, // its own YouTube override: the library video never plays there
      { owner: "p3", media_url: "https://vimeo.com/1" }, // a link, not a video: the library video still plays
      { owner: "p4", media_url: url(W) },
      { owner: "p4", media_url: null }, // p4 counts through this row
    ]),
    3,
  );
  assert.equal(sync.countShownLibraryVideo([]), 0);
});

// ---------------------------------------------------------------------------
// Server actions over a small in-memory PostgREST stand-in. `migrated: false`
// behaves like the database before 0021 (no day_templates.deleted_at).
// ---------------------------------------------------------------------------

function makeDb({ library = [], exercises = [], dayTemplates = [], dayRows = [], migrated = true, fail = {} } = {}) {
  const log = [];
  const db = {
    library: structuredClone(library),
    exercises: structuredClone(exercises),
    dayRows: structuredClone(dayRows),
    templates: structuredClone(dayTemplates),
  };
  let seq = 900;

  const plainCols = (cols) =>
    (cols ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c && !/[()!]/.test(c));
  const templateOf = (row) => db.templates.find((tp) => tp.id === row.template_id);
  const valueOf = (row, key) =>
    key.startsWith("day_templates.") ? (templateOf(row)?.[key.slice("day_templates.".length)] ?? null) : (row[key] ?? null);
  const matches = (row, [op, key, value]) => (op === "eq" || op === "is" ? valueOf(row, key) === value : true);

  function out(q) {
    const cols = plainCols(q.cols);
    return (row) => (cols.length ? Object.fromEntries(cols.map((c) => [c, row[c] ?? null])) : { ...row });
  }
  function list(q, rows) {
    const sliced = q.range ? rows.slice(q.range[0], q.range[1] + 1) : rows;
    return { data: sliced.map(out(q)), error: null };
  }
  function one(q, rows) {
    if (q.single) return { data: rows[0] ? out(q)(rows[0]) : null, error: null };
    return list(q, rows);
  }

  function run(q) {
    log.push(q);
    if (q.table === "exercises") {
      if (q.op !== "select") return { data: null, error: { message: "unexpected exercises write" } };
      if (q.fail) return { data: null, error: q.fail };
      return list(q, db.exercises.filter((r) => q.filters.every((f) => matches(r, f))));
    }
    if (q.table === "day_template_exercises") {
      const joined = /day_templates!inner\(deleted_at\)/.test(q.cols ?? "");
      if (joined && !migrated) {
        return { data: null, error: { code: "42703", message: "column day_templates.deleted_at does not exist" } };
      }
      let rows = db.dayRows.filter((r) => q.filters.every((f) => matches(r, f)));
      if (joined) rows = rows.filter((r) => templateOf(r)); // inner join
      return list(q, rows);
    }
    if (q.table === "exercise_library") {
      if (q.op === "select") {
        if (fail.read) return { data: null, error: fail.read };
        return one(q, db.library.filter((r) => q.filters.every((f) => matches(r, f))));
      }
      if (q.op === "update") {
        if (fail.update) return { data: null, error: fail.update };
        const rows = db.library.filter((r) => q.filters.every((f) => matches(r, f)));
        for (const row of rows) Object.assign(row, q.payload);
        return one(q, rows);
      }
      if (q.op === "insert") {
        if (fail.insert) return { data: null, error: fail.insert };
        const taken = db.library.some((r) => r.name.toLowerCase() === q.payload.name.toLowerCase());
        if (taken) {
          return {
            data: null,
            error: { code: "23505", message: 'duplicate key value violates unique constraint "exercise_library_name_key"' },
          };
        }
        const row = { id: id(++seq), created_at: "2026-10-10T00:00:00.000Z", default_instructions: null, youtube_url: null, ...q.payload };
        db.library.push(row);
        return one(q, [row]);
      }
      if (q.op === "delete") {
        const gone = db.library.filter((r) => q.filters.every((f) => matches(r, f)));
        db.library = db.library.filter((r) => !gone.includes(r));
        // exercises.library_id and day_template_exercises.library_id are ON DELETE SET NULL.
        for (const row of [...db.exercises, ...db.dayRows]) {
          if (gone.some((g) => g.id === row.library_id)) row.library_id = null;
        }
        return { data: null, error: null };
      }
    }
    return { data: null, error: { message: `unexpected ${q.table} ${q.op}` } };
  }

  function from(table) {
    const q = { table, op: "select", cols: null, filters: [], range: null, single: false, payload: null, fail: null };
    if (table === "exercises") q.fail = fail.exercises ?? null;
    if (table === "day_template_exercises") q.fail = fail.dayRows ?? null;
    const b = {
      select(cols) {
        q.cols = cols;
        return b;
      },
      insert(payload) {
        q.op = "insert";
        q.payload = payload;
        return b;
      },
      update(payload) {
        q.op = "update";
        q.payload = payload;
        return b;
      },
      delete() {
        q.op = "delete";
        return b;
      },
      eq(key, value) {
        q.filters.push(["eq", key, value]);
        return b;
      },
      is(key, value) {
        q.filters.push(["is", key, value]);
        return b;
      },
      order() {
        return b;
      },
      range(from, to) {
        q.range = [from, to];
        return b;
      },
      returns() {
        return b;
      },
      maybeSingle() {
        q.single = true;
        return b;
      },
      single() {
        q.single = true;
        return b;
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(run(q)).then(onFulfilled, onRejected);
      },
    };
    return b;
  }

  return { client: { from }, db, log };
}

// Load the server actions with requireStaff / getLang / revalidatePath mocked.
let fake = null;
let lang = "en";
let staffCalls = 0;
let staffFails = false;
const revalidated = [];
const original = Module._load;
Module._load = function (request, parent, main) {
  if (request === "@/lib/admin-auth") {
    return {
      requireStaff: async () => {
        if (staffFails) throw new Error("redirect");
        staffCalls++;
        return { supabase: fake.client };
      },
    };
  }
  if (request === "@/lib/i18n-server") return { getLang: async () => lang };
  if (request === "next/cache") return { revalidatePath: (...args) => revalidated.push(args) };
  return original.call(this, request, parent, main);
};
const actions = require("../src/app/admin/library-actions.ts");
Module._load = original;

const quiet = (fn) => async () => {
  const log = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = log;
  }
};

const L = id(50); // the library entry under test
const P = (n) => id(100 + n); // programmes
const T = (n) => id(200 + n); // saved days
const libraryRow = (extra = {}) => ({
  id: L,
  name: "Plank",
  default_instructions: "Old cues",
  youtube_url: url(W),
  created_at: "2026-09-01T00:00:00.000Z",
  ...extra,
});

/** Programmes and saved days that use the entry, in each of the cases the count must get right. */
function usageFixture(extra = {}) {
  return {
    library: [libraryRow()],
    exercises: [
      { id: id(1), program_id: P(1), library_id: L, media_url: null },
      { id: id(2), program_id: P(1), library_id: L, media_url: null }, // same programme twice
      { id: id(3), program_id: P(2), library_id: L, media_url: url(W) }, // its own YouTube override
      { id: id(4), program_id: P(3), library_id: L, media_url: "https://vimeo.com/1" }, // a link, not a video
      { id: id(5), program_id: P(4), library_id: id(51), media_url: null }, // another entry
    ],
    dayTemplates: [
      { id: T(1), deleted_at: null },
      { id: T(2), deleted_at: "2026-09-20T00:00:00.000Z" },
    ],
    dayRows: [
      { id: id(11), template_id: T(1), library_id: L, media_url: null },
      { id: id(12), template_id: T(1), library_id: L, media_url: null },
      { id: id(13), template_id: T(2), library_id: L, media_url: null }, // a deleted saved day
      { id: id(14), template_id: T(1), library_id: L, media_url: url(V) }, // own override only
    ],
    ...extra,
  };
}

test("usage counts programmes and live saved days, excluding own overrides and deleted days", quiet(async () => {
  lang = "en";
  fake = makeDb(usageFixture());
  const res = await actions.libraryExerciseUsage({ id: L });
  assert.deepEqual(res, { ok: true, programmes: 2, savedDays: 1 });

  const joined = fake.log.find((q) => q.table === "day_template_exercises");
  assert.match(joined.cols, /day_templates!inner\(deleted_at\)/);
  assert.ok(joined.filters.some((f) => f[1] === "day_templates.deleted_at" && f[2] === null), "only live saved days");
}));

test("before migration 0021 every saved day counts, through the legacy select", quiet(async () => {
  lang = "en";
  fake = makeDb({ ...usageFixture(), migrated: false });
  const res = await actions.libraryExerciseUsage({ id: L });
  assert.deepEqual(res, { ok: true, programmes: 2, savedDays: 2 });
  const legacy = fake.log.filter((q) => q.table === "day_template_exercises").at(-1);
  assert.equal(legacy.cols, "template_id, media_url");
}));

test("usage pages past the row cap, so a large count is exact", quiet(async () => {
  const exercises = Array.from({ length: 1001 }, (_, i) => ({
    id: id(20000 + i),
    program_id: id(30000 + i),
    library_id: L,
    media_url: null,
  }));
  fake = makeDb({ library: [libraryRow()], exercises });
  const res = await actions.libraryExerciseUsage({ id: L });
  assert.deepEqual(res, { ok: true, programmes: 1001, savedDays: 0 });
  const pages = fake.log.filter((q) => q.table === "exercises").map((q) => q.range);
  assert.deepEqual(pages, [[0, 999], [1000, 1999]]);
}));

test("a failed count reads as a localized, retryable error; a bad id reads as gone", quiet(async () => {
  lang = "tr";
  fake = makeDb({ ...usageFixture(), fail: { exercises: { code: "XX000", message: "boom" } } });
  assert.deepEqual(await actions.libraryExerciseUsage({ id: L }), { ok: false, error: t("tr", "lib.sync.countFailed") });
  lang = "en";
  fake = makeDb({ library: [libraryRow()] });
  assert.deepEqual(await actions.libraryExerciseUsage({ id: "nope" }), { ok: false, error: t("en", "lib.sync.gone") });
}));

test("an update writes only the keys the row pushes and reports the old and new values", quiet(async () => {
  lang = "en";
  fake = makeDb({ library: [libraryRow()] });
  const res = await actions.updateLibraryFromExercise({ id: L, instructions: "  Goal: hold\n* Breathe  " });
  assert.deepEqual(res, {
    ok: true,
    name: "Plank",
    previous: { default_instructions: "Old cues" },
    next: { default_instructions: "Goal: hold\n* Breathe" },
  });
  const row = fake.db.library.find((r) => r.id === L);
  assert.equal(row.default_instructions, "Goal: hold\n* Breathe");
  assert.equal(row.youtube_url, url(W), "the video is untouched");
  const write = fake.log.find((q) => q.op === "update");
  assert.deepEqual(Object.keys(write.payload), ["default_instructions"]);
  assert.deepEqual(revalidated.at(-1), ["/admin/library"]);

  const video = await actions.updateLibraryFromExercise({ id: L, videoUrl: `https://youtu.be/${V}?si=abc` });
  assert.deepEqual(video, {
    ok: true,
    name: "Plank",
    previous: { youtube_url: url(W) },
    next: { youtube_url: url(V) },
  });
  assert.equal(fake.db.library.find((r) => r.id === L).youtube_url, url(V));
  assert.equal(fake.db.library.find((r) => r.id === L).default_instructions, "Goal: hold\n* Breathe", "cues untouched by a video update");
}));

test("a non-YouTube video is refused in the chosen language, and nothing is written", quiet(async () => {
  fake = makeDb({ library: [libraryRow()] });
  lang = "en";
  assert.deepEqual(
    await actions.updateLibraryFromExercise({ id: L, videoUrl: "https://vimeo.com/76979871" }),
    { ok: false, error: t("en", "err.notYouTube") },
  );
  lang = "tr";
  const tr = await actions.updateLibraryFromExercise({ id: L, videoUrl: "https://vimeo.com/76979871" });
  assert.deepEqual(tr, { ok: false, error: t("tr", "err.notYouTube") });
  assert.notEqual(t("tr", "err.notYouTube"), t("en", "err.notYouTube"));
  assert.match(tr.error, /YouTube/);
  assert.equal(fake.log.some((q) => q.op === "update"), false);
  lang = "en";
}));

test("an empty patch, blank cues or a failed write reads as an update error", quiet(async () => {
  lang = "en";
  const updateError = t("en", "lib.sync.updateError");
  fake = makeDb({ library: [libraryRow()] });
  assert.deepEqual(await actions.updateLibraryFromExercise({ id: L }), { ok: false, error: updateError });
  assert.deepEqual(await actions.updateLibraryFromExercise({ id: L, instructions: "  \n " }), { ok: false, error: updateError });
  assert.equal(fake.log.some((q) => q.op === "update"), false);
  fake = makeDb({ library: [libraryRow()], fail: { update: { code: "XX000", message: "boom" } } });
  assert.deepEqual(await actions.updateLibraryFromExercise({ id: L, instructions: "Hold" }), { ok: false, error: updateError });
}));

test("a missing entry reads as gone, for update, restore and an invalid id", quiet(async () => {
  lang = "en";
  const gone = { ok: false, error: t("en", "lib.sync.gone") };
  fake = makeDb({ library: [] });
  assert.deepEqual(await actions.updateLibraryFromExercise({ id: L, instructions: "Hold" }), gone);
  assert.deepEqual(await actions.restoreLibraryExercise({ id: L, values: { youtube_url: null } }), gone);
  assert.deepEqual(await actions.updateLibraryFromExercise({ id: "not-an-id", instructions: "Hold" }), gone);
}));

test("restore writes the previous values back, only for the keys given", quiet(async () => {
  lang = "en";
  fake = makeDb({ library: [libraryRow({ default_instructions: "Changed", youtube_url: url(V) })] });
  const row = () => fake.db.library.find((r) => r.id === L);
  assert.deepEqual(
    await actions.restoreLibraryExercise({ id: L, values: { default_instructions: "  Old cues  ", youtube_url: null } }),
    { ok: true, name: "Plank" },
  );
  assert.equal(row().default_instructions, "Old cues");
  assert.equal(row().youtube_url, null);

  await actions.restoreLibraryExercise({ id: L, values: { default_instructions: "   " } });
  assert.equal(row().default_instructions, null, "blank cues restore as none");

  await actions.restoreLibraryExercise({ id: L, values: { youtube_url: `https://youtu.be/${W}` } });
  assert.equal(row().youtube_url, url(W), "a YouTube link is normalised");

  const undoError = t("en", "lib.sync.undoError");
  assert.deepEqual(await actions.restoreLibraryExercise({ id: L, values: { youtube_url: "https://vimeo.com/1" } }), { ok: false, error: undoError });
  assert.deepEqual(await actions.restoreLibraryExercise({ id: L, values: {} }), { ok: false, error: undoError });
}));

test("add stores a normalised YouTube link, and no link for a non-YouTube one", quiet(async () => {
  lang = "en";
  fake = makeDb({ library: [] });
  const res = await actions.addExerciseToLibrary({
    name: "  Plank  ",
    instructions: "  Goal: hold\n* Breathe  ",
    videoUrl: `https://youtu.be/${V}?si=x`,
  });
  assert.equal(res.ok, true);
  assert.deepEqual(res.entry, {
    id: res.entry.id,
    name: "Plank",
    youtube_url: url(V),
    default_instructions: "Goal: hold\n* Breathe",
    created_at: "2026-10-10T00:00:00.000Z",
    category_ids: [],
  });
  assert.deepEqual(revalidated.at(-1), ["/admin/library"]);

  const bridge = await actions.addExerciseToLibrary({ name: "Bridge", instructions: "   ", videoUrl: "https://vimeo.com/1" });
  assert.equal(bridge.ok, true);
  const stored = fake.db.library.find((r) => r.name === "Bridge");
  assert.equal(stored.youtube_url, null, "a demo link stays on the row");
  assert.equal(stored.default_instructions, null, "blank cues are stored as none");
}));

test("add refuses an empty name, reports a duplicate with the name, and maps other failures", quiet(async () => {
  lang = "en";
  fake = makeDb({ library: [libraryRow()] });
  assert.deepEqual(
    await actions.addExerciseToLibrary({ name: "   ", instructions: null, videoUrl: null }),
    { ok: false, error: t("en", "err.giveExerciseName") },
  );
  const dup = await actions.addExerciseToLibrary({ name: "  plank ", instructions: null, videoUrl: null });
  assert.deepEqual(dup, { ok: false, error: t("en", "lib.sync.exists", { name: "plank" }) });
  assert.match(dup.error, /plank/);
  assert.equal(fake.db.library.length, 1);

  fake = makeDb({ library: [], fail: { insert: { code: "XX000", message: "boom" } } });
  assert.deepEqual(
    await actions.addExerciseToLibrary({ name: "Hip bridge", instructions: null, videoUrl: null }),
    { ok: false, error: t("en", "lib.sync.addError") },
  );
}));

test("undoing an add deletes the entry and leaves rows that pointed at it with their names", quiet(async () => {
  lang = "en";
  fake = makeDb({
    library: [libraryRow()],
    exercises: [{ id: id(1), program_id: P(1), name: "Plank", library_id: L, media_url: null }],
  });
  assert.deepEqual(await actions.removeAddedLibraryExercise({ id: L }), { ok: true });
  assert.equal(fake.db.library.length, 0);
  assert.equal(fake.db.exercises[0].library_id, null);
  assert.equal(fake.db.exercises[0].name, "Plank");
  assert.deepEqual(await actions.removeAddedLibraryExercise({ id: "nope" }), { ok: false, error: t("en", "lib.sync.undoError") });
}));

test("every library-sync action is staff-gated before it touches the database", quiet(async () => {
  lang = "en";
  const calls = [
    () => actions.libraryExerciseUsage({ id: L }),
    () => actions.updateLibraryFromExercise({ id: L, instructions: "Hold" }),
    () => actions.restoreLibraryExercise({ id: L, values: { youtube_url: null } }),
    () => actions.addExerciseToLibrary({ name: "New", instructions: null, videoUrl: null }),
    () => actions.removeAddedLibraryExercise({ id: L }),
  ];

  fake = makeDb({ library: [libraryRow()] });
  for (const call of calls) {
    const before = staffCalls;
    await call();
    assert.equal(staffCalls, before + 1, "each action checks staff once");
  }

  staffFails = true;
  fake = makeDb({ library: [libraryRow()] });
  try {
    for (const call of calls) await assert.rejects(call(), /redirect/);
  } finally {
    staffFails = false;
  }
  assert.equal(fake.log.length, 0, "no query runs for a non-staff caller");
}));
