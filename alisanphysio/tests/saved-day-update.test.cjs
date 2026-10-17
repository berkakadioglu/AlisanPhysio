/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const sd = require("../src/lib/saved-days.ts");
const ops = require("../src/app/admin/editor/day-ops.ts");
const { toDayDraft } = require("../src/app/admin/editor/drafts.ts");
const { editorDays } = require("../src/lib/program-editor-data.ts");
const { t } = require("../src/lib/i18n.ts");

// Made-up ids and exercises only.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ex = (name, extra = {}) => ({ name, sets: 3, reps: "8-12", instructions: "Cue", media_url: null, library_id: null, ...extra });
const sv = (name, order, extra = {}) => ({ name, sets: 3, reps: "8-12", instructions: "Cue", media_url: null, library_id: null, order_index: order, ...extra });
const tpl = (n, title, extra = {}) => ({
  id: id(n), title, created_at: "2026-09-01T08:00:00.000Z", updated_at: "2026-09-02T08:00:00.000Z",
  deleted_at: null, source_label: null, exercises: [], ...extra,
});
const dayWith = (title, exercises = [], extra = {}) => ({ title, sourceTemplateLabel: null, sourceTemplateId: null, exercises, ...extra });

// ---------------------------------------------------------------------------
// savedDayDiff: what "Update saved day" would change
// ---------------------------------------------------------------------------

test("savedDayDiff: identical exercises are the same, whatever the blank rows and spacing", () => {
  const saved = [
    sv("Press", 0, { media_url: "https://youtu.be/abc", library_id: id(5) }),
    sv("Row", 1, { reps: "10", instructions: null, media_url: null }),
  ];
  const next = [
    ex("  Press  ", { reps: " 8-12 ", instructions: "Cue  ", media_url: "  https://youtu.be/abc ", library_id: id(5) }),
    ex("   "),
    ex("Row", { reps: "10", instructions: "   ", media_url: "" }),
  ];
  assert.deepEqual(sd.savedDayDiff(saved, next), { added: [], removed: [], changed: [], reordered: false, same: true });
  assert.deepEqual(sd.savedDayDiff([], []), { added: [], removed: [], changed: [], reordered: false, same: true });
});

test("savedDayDiff names what is added (day order) and removed (saved order)", () => {
  const d = sd.savedDayDiff([sv("Row", 1), sv("Press", 0), sv("Curl", 2)], [ex("Press"), ex("Dip"), ex("Plank")]);
  assert.deepEqual(d.added, ["Dip", "Plank"]);
  assert.deepEqual(d.removed, ["Row", "Curl"], "the saved order, not the array order");
  assert.equal(d.reordered, false, "the one paired exercise keeps its place");
  assert.equal(d.same, false);
});

test("savedDayDiff reports which part of a paired exercise changed", () => {
  const fields = (old, next) => sd.savedDayDiff([sv("Press", 0, old)], [ex("Press", next)]).changed[0]?.fields ?? [];
  assert.deepEqual(fields({}, { sets: 4 }), ["dose"]);
  assert.deepEqual(fields({}, { reps: "10" }), ["dose"]);
  assert.deepEqual(fields({}, { instructions: "Brace" }), ["cues"]);
  assert.deepEqual(fields({}, { media_url: "https://youtu.be/xyz" }), ["video"]);
  assert.deepEqual(fields({}, { library_id: id(9) }), ["link"]);
  assert.deepEqual(fields({}, {}), [], "identical content is not a change");
  assert.deepEqual(
    sd.savedDayDiff([sv("press", 0)], [ex("Press")]).changed,
    [{ name: "Press", fields: ["name"] }],
    "a case-only rename is a name change, shown with the new spelling",
  );
  assert.deepEqual(
    sd.savedDayDiff([sv("press", 0)], [ex("Press", { sets: 4, reps: "6", instructions: "Brace", media_url: "https://youtu.be/xyz", library_id: id(9) })]).changed,
    [{ name: "Press", fields: ["name", "dose", "cues", "video", "link"] }],
  );
});

test("savedDayDiff pairs a repeated name in order", () => {
  const twice = [sv("Press", 0, { sets: 3 }), sv("Press", 1, { sets: 4 })];
  assert.equal(sd.savedDayDiff(twice, [ex("Press", { sets: 3 }), ex("Press", { sets: 4 })]).same, true);

  const first = sd.savedDayDiff(twice, [ex("Press", { sets: 5 }), ex("Press", { sets: 4 })]);
  assert.deepEqual(first.changed, [{ name: "Press", fields: ["dose"] }]);
  assert.deepEqual([first.added, first.removed], [[], []]);

  // One Press left: it pairs with the FIRST old Press, the second one is removed.
  const fewer = sd.savedDayDiff(twice, [ex("Press", { sets: 4 })]);
  assert.deepEqual(fewer.changed, [{ name: "Press", fields: ["dose"] }]);
  assert.deepEqual(fewer.removed, ["Press"]);
});

test("savedDayDiff detects a reordered day, and ignores the order the saved rows were fetched in", () => {
  const abc = [sv("A", 0), sv("B", 1), sv("C", 2)];
  assert.deepEqual(sd.savedDayDiff(abc, [ex("B"), ex("A"), ex("C")]), { added: [], removed: [], changed: [], reordered: true, same: false });
  assert.equal(sd.savedDayDiff(abc, [ex("A"), ex("C"), ex("B")]).reordered, true);
  assert.equal(sd.savedDayDiff(abc.slice().reverse(), [ex("A"), ex("B"), ex("C")]).same, true, "saved rows are sorted by order_index");

  const moved = sd.savedDayDiff([sv("A", 0), sv("B", 1)], [ex("B"), ex("C"), ex("A")]);
  assert.equal(moved.reordered, true);
  assert.deepEqual(moved.added, ["C"]);
  assert.equal(moved.same, false);
});

test("savedDayDiff lists changed exercises in day order", () => {
  const d = sd.savedDayDiff([sv("A", 0), sv("B", 1)], [ex("B", { sets: 4 }), ex("A", { sets: 4 })]);
  assert.deepEqual(d.changed.map((c) => c.name), ["B", "A"]);
  assert.equal(d.reordered, true);
});

// ---------------------------------------------------------------------------
// The saved-day id on editor days (only ever used to offer "Update saved day")
// ---------------------------------------------------------------------------

test("an inserted saved day remembers its id; the id travels with drafts, copies and saves", () => {
  const inserted = sd.savedDayToEditorDay(tpl(7, "Push Day", { exercises: [
    { id: id(70), template_id: id(7), name: "Press", sets: 3, reps: "8", instructions: null, media_url: null, library_id: null, order_index: 0 },
  ] }));
  assert.equal(inserted.sourceTemplateId, id(7));
  assert.equal(inserted.sourceTemplateLabel, "Push Day");

  assert.equal(ops.emptyDay().sourceTemplateId, null);
  const days = ops.initialDays([dayWith("Upper", [ex("Plank")], { sourceTemplateLabel: "Core Day", sourceTemplateId: id(3) })]);
  assert.equal(days[0].sourceTemplateId, id(3));
  assert.equal(toDayDraft(inserted).sourceTemplateId, id(7));
  assert.equal(ops.toSaveDays(days)[0].sourceTemplateId, id(3));
  assert.equal(ops.toSaveDays(ops.initialDays([dayWith("Plain", [ex("Plank")])]))[0].sourceTemplateId, null);
  assert.equal(ops.duplicateDay(days, days[0].key).days[1].sourceTemplateId, id(3), "a duplicate keeps the link");
  assert.equal(ops.asEditorDays([{ title: "A", sourceTemplateId: id(4), exercises: [] }])[0].sourceTemplateId, id(4));
  assert.equal(ops.asEditorDays([{ title: "A", exercises: [] }])[0].sourceTemplateId, null);
});

test("changing a day's saved-day id makes the editor dirty; the same id does not", () => {
  const days = ops.initialDays([dayWith("Upper", [ex("Plank")], { sourceTemplateId: id(3) })]);
  const state = { title: "October 2026", monthStartDate: "2026-10-01", notes: "", days };
  const snap = ops.editorSnapshot(state);
  assert.notEqual(snap, ops.editorSnapshot({ ...state, days: ops.patchDay(days, days[0].key, { sourceTemplateId: id(5) }) }));
  assert.notEqual(snap, ops.editorSnapshot({ ...state, days: ops.patchDay(days, days[0].key, { sourceTemplateId: null }) }));
  assert.equal(snap, ops.editorSnapshot({ ...state, days: ops.patchDay(days, days[0].key, { sourceTemplateId: id(3) }) }));
});

test("loaded days carry the trimmed saved-day id; the ungrouped bucket has none", () => {
  const days = [
    { id: "d1", title: "Push", order_index: 0, source_template_label: "Push", source_template_id: ` ${id(1)} ` },
    { id: "d2", title: "Legs", order_index: 1, source_template_label: null, source_template_id: "" },
    { id: "d3", title: "Pull", order_index: 2 },
  ];
  const exercises = [
    { id: "e1", day_id: "d1", order_index: 0, name: "Press" },
    { id: "e2", day_id: null, order_index: 1, name: "Walk" },
  ];
  const out = editorDays(days, exercises, "Other");
  assert.deepEqual(out.map((d) => [d.title, d.sourceTemplateId]), [["Push", id(1)], ["Legs", null], ["Pull", null], ["Other", null]]);
});

// ---------------------------------------------------------------------------
// A small fake for the loader, the server actions and the save/undo links.
// `missing` names columns the database does not have (like before 0021/0022).
// ---------------------------------------------------------------------------

function loaderDb({ days, exercises, missing = [] }) {
  const selects = [];
  return {
    selects,
    from(table) {
      const q = { table, cols: "" };
      const b = {
        select(cols) {
          q.cols = cols;
          if (table === "program_days") selects.push(cols);
          return b;
        },
        eq() { return b; },
        order() { return b; },
        returns() { return b; },
        then(ok, err) {
          let result = { data: exercises, error: null };
          if (table === "program_days") {
            const names = q.cols.split(",").map((c) => c.trim());
            const firstMissing = names.find((c) => missing.includes(c));
            result = firstMissing
              ? { data: null, error: { code: "42703", message: `column program_days.${firstMissing} does not exist` } }
              : {
                data: days.map((d) => ({
                  id: d.id, program_id: d.program_id, title: d.title, order_index: d.order_index, created_at: d.created_at,
                  ...(names.includes("source_template_label") ? { source_template_label: d.source_template_label } : {}),
                  ...(names.includes("source_template_id") ? { source_template_id: d.source_template_id } : {}),
                })),
                error: null,
              };
          }
          return Promise.resolve(result).then(ok, err);
        },
      };
      return b;
    },
  };
}

const programDayRows = [
  { id: "p0", program_id: "prog", title: "Push", order_index: 0, created_at: "2026-10-01T00:00:00Z", source_template_label: "Push Day", source_template_id: id(1) },
  { id: "p1", program_id: "prog", title: "Legs", order_index: 1, created_at: "2026-10-01T00:00:00Z", source_template_label: null, source_template_id: null },
];
const programExercises = [{ id: "e1", day_id: "p0", order_index: 0, name: "Press", sets: 3, reps: "8", instructions: null, media_url: null, library_id: null, program_id: "prog" }];

test("loadEditorDays maps source_template_id, and drops each missing column with a retry", async () => {
  const { loadEditorDays } = require("../src/lib/program-editor-loader.ts");

  const full = loaderDb({ days: programDayRows, exercises: programExercises });
  const loaded = await loadEditorDays(full, "prog", "Other");
  assert.deepEqual(loaded.map((d) => [d.title, d.sourceTemplateLabel, d.sourceTemplateId]), [["Push", "Push Day", id(1)], ["Legs", null, null]]);
  assert.equal(full.selects.length, 1, "one query when every column exists");
  assert.match(full.selects[0], /source_template_label, source_template_id$/);

  const before0022 = loaderDb({ days: programDayRows, exercises: programExercises, missing: ["source_template_id"] });
  const older = await loadEditorDays(before0022, "prog", "Other");
  assert.deepEqual(older.map((d) => [d.sourceTemplateLabel, d.sourceTemplateId]), [["Push Day", null], [null, null]], "the origin label survives");
  assert.equal(before0022.selects.length, 2);
  assert.doesNotMatch(before0022.selects[1], /source_template_id/);

  const before0021 = loaderDb({ days: programDayRows, exercises: programExercises, missing: ["source_template_label", "source_template_id"] });
  const legacy = await loadEditorDays(before0021, "prog", "Other");
  assert.deepEqual(legacy.map((d) => [d.title, d.sourceTemplateLabel, d.sourceTemplateId]), [["Push", null, null], ["Legs", null, null]]);
  assert.equal(before0021.selects.length, 2, "one failed query, then the plain columns");
  assert.deepEqual(legacy[0].exercises.map((e) => e.name), ["Press"], "exercises still load");
});

// Load the server actions with requireStaff / getLang / revalidatePath mocked.
let currentDb = null;
let lang = "en";
let staffCalls = 0;
const revalidated = [];
const original = Module._load;
Module._load = function (request, parent, main) {
  if (request === "@/lib/admin-auth") return {
    requireStaff: async () => { staffCalls++; return { supabase: currentDb }; },
    requireAdmin: async () => { staffCalls++; return { supabase: currentDb }; },
  };
  if (request === "@/lib/i18n-server") return { getLang: async () => lang };
  if (request === "@/lib/supabase/admin") return { createAdminClient: () => { throw new Error("service role must not be used"); } };
  if (request === "next/cache") return { revalidatePath: (...args) => revalidated.push(args) };
  return original.call(this, request, parent, main);
};
const actions = require("../src/app/admin/actions.ts");
const templateActions = require("../src/app/admin/template-actions.ts");
Module._load = original;

/** A small PostgREST stand-in: saved days, programme days and RPCs. */
function makeDb({ templates = [], programDays = [], rpc = null, programDayError = null } = {}) {
  const log = [];
  const state = { templates: structuredClone(templates), programDays: structuredClone(programDays) };
  const matches = (row, filters) => filters.every(([op, key, value]) => (
    op === "is" ? (row[key] ?? null) === value : row[key] === value
  ));
  function run(q) {
    if (q.table === "day_templates") {
      const rows = state.templates.filter((r) => matches(r, q.filters));
      return {
        data: rows.map((r) => ({
          id: r.id, title: r.title, created_at: r.created_at, updated_at: r.updated_at ?? r.created_at,
          deleted_at: r.deleted_at ?? null, source_label: null,
        })),
        error: null,
      };
    }
    if (q.table === "program_days") {
      if (programDayError) return { data: null, error: programDayError };
      const rows = state.programDays.filter((r) => matches(r, q.filters));
      if (q.op === "update") for (const r of rows) Object.assign(r, q.payload);
      return { data: rows.map((r) => ({ id: r.id })), error: null };
    }
    return { data: null, error: null };
  }
  return {
    log,
    state,
    from(table) {
      const q = { table, op: "select", filters: [], payload: null };
      log.push(q);
      const b = {
        select() { return b; },
        update(payload) { q.op = "update"; q.payload = payload; return b; },
        eq(key, value) { q.filters.push(["eq", key, value]); return b; },
        is(key, value) { q.filters.push(["is", key, value]); return b; },
        order() { return b; },
        range() { return b; },
        returns() { return b; },
        then(ok, err) { return Promise.resolve(run(q)).then(ok, err); },
      };
      return b;
    },
    async rpc(name, args) {
      log.push({ rpc: name, args });
      return rpc ? rpc(name, args) : { data: null, error: null };
    },
  };
}

/** Runs fn with console.error captured, so expected failures stay quiet. */
async function quietly(fn) {
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args);
  try {
    return await fn(logged);
  } finally {
    console.error = originalError;
  }
}

test("saveProgram stores each day's saved-day id only when it is a uuid", async () => {
  currentDb = makeDb({ rpc: async () => ({ data: id(60), error: null }) });
  const res = await actions.saveProgram({
    kind: "catalog", clientId: null, title: "Strength", monthStartDate: null, notes: "",
    days: [
      { title: "Push", sourceTemplateLabel: "Push", sourceTemplateId: id(1), exercises: [ex("Press")] },
      { title: "Pull", sourceTemplateLabel: null, sourceTemplateId: "not-a-uuid", exercises: [ex("Row")] },
      { title: "Legs", exercises: [ex("Squat")] },
      { title: "Core", sourceTemplateId: 42, exercises: [ex("Plank")] },
    ],
  });
  assert.deepEqual(res, { ok: true, programId: id(60) });
  const [call] = currentDb.log.filter((q) => q.rpc);
  assert.equal(call.rpc, "save_program");
  assert.deepEqual(call.args.p_days.map((d) => [d.title, d.source_template_id]), [
    ["Push", id(1)], ["Pull", null], ["Legs", null], ["Core", null],
  ]);
});

test("saveDayAsTemplate with a link points that programme day at the new saved day", async () => {
  const programId = id(70);
  currentDb = makeDb({
    programDays: [
      { id: "d0", program_id: programId, order_index: 0, source_template_id: null },
      { id: "d2", program_id: programId, order_index: 2, source_template_id: null },
      { id: "x2", program_id: id(71), order_index: 2, source_template_id: null },
    ],
    rpc: async () => ({ data: id(900), error: null }),
  });
  const res = await templateActions.saveDayAsTemplate({
    title: "Push Day", exercises: [ex("Press")], sourceLabel: null, link: { programId, dayIndex: 2 },
  });
  assert.deepEqual(res, { ok: true, templateId: id(900), title: "Push Day", replacedId: null, linked: true });
  assert.deepEqual(currentDb.state.programDays.map((r) => [r.id, r.source_template_id]), [["d0", null], ["d2", id(900)], ["x2", null]]);
  const update = currentDb.log.find((q) => q.table === "program_days");
  assert.deepEqual(update.payload, { source_template_id: id(900) });
  assert.deepEqual(update.filters, [["eq", "program_id", programId], ["eq", "order_index", 2]]);
});

test("saveDayAsTemplate still saves when the link cannot be recorded, and says so", async () => {
  const programId = id(70);
  const rpc = async () => ({ data: id(900), error: null });
  const programDays = [{ id: "d2", program_id: programId, order_index: 2, source_template_id: null }];

  await quietly(async (logged) => {
    currentDb = makeDb({ programDays, rpc, programDayError: { code: "42703", message: "column program_days.source_template_id does not exist" } });
    const res = await templateActions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, link: { programId, dayIndex: 2 } });
    assert.deepEqual(res, { ok: true, templateId: id(900), title: "Push Day", replacedId: null, linked: false });
    assert.equal(logged.length, 0, "a missing column before 0022 is not an error");
  });

  await quietly(async (logged) => {
    currentDb = makeDb({ programDays, rpc, programDayError: { code: "XX000", message: "private detail" } });
    const res = await templateActions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, link: { programId, dayIndex: 2 } });
    assert.equal(res.ok, true);
    assert.equal(res.linked, false);
    assert.equal(logged.length, 1, "other failures are logged, never shown");
  });

  // No day at that position (or more than one): not linked, the save still succeeds.
  currentDb = makeDb({ programDays, rpc });
  const missingDay = await templateActions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, link: { programId, dayIndex: 5 } });
  assert.equal(missingDay.ok, true);
  assert.equal(missingDay.linked, false);

  // An invalid link is never written.
  for (const link of [{ programId: "nope", dayIndex: 2 }, { programId, dayIndex: -1 }, { programId, dayIndex: 1.5 }]) {
    currentDb = makeDb({ programDays, rpc });
    const res = await templateActions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, link });
    assert.equal(res.linked, false);
    assert.equal(currentDb.log.filter((q) => q.table === "program_days").length, 0);
  }

  // Without a link the result still reports linked: false.
  currentDb = makeDb({ rpc });
  assert.equal((await templateActions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null })).linked, false);
});

test("undoSaveDayAsTemplate with a link gives the programme day its previous saved day back, if still unlinked", async () => {
  const programId = id(70);
  const rpc = async () => ({ data: null, error: null });

  currentDb = makeDb({
    programDays: [
      { id: "d2", program_id: programId, order_index: 2, source_template_id: null },
      { id: "e2", program_id: id(71), order_index: 2, source_template_id: null },
    ],
    rpc,
  });
  const res = await templateActions.undoSaveDayAsTemplate({
    templateId: id(900), restoreId: null, link: { programId, dayIndex: 2, previousTemplateId: id(1) },
  });
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(currentDb.log.find((q) => q.rpc), { rpc: "revert_day_template_save", args: { p_created_id: id(900), p_restore_id: null } });
  const update = currentDb.log.find((q) => q.table === "program_days");
  assert.deepEqual(update.payload, { source_template_id: id(1) });
  assert.deepEqual(update.filters, [["eq", "program_id", programId], ["eq", "order_index", 2], ["is", "source_template_id", null]]);
  assert.deepEqual(currentDb.state.programDays.map((r) => [r.id, r.source_template_id]), [["d2", id(1)], ["e2", null]]);

  // Linked again since the save: the is-null guard leaves that link alone.
  currentDb = makeDb({ programDays: [{ id: "d2", program_id: programId, order_index: 2, source_template_id: id(555) }], rpc });
  assert.deepEqual(await templateActions.undoSaveDayAsTemplate({ templateId: id(900), restoreId: null, link: { programId, dayIndex: 2, previousTemplateId: id(1) } }), { ok: true });
  assert.equal(currentDb.state.programDays[0].source_template_id, id(555));

  // Nothing to restore, or a bad id: no programme-day write at all.
  currentDb = makeDb({ rpc });
  await templateActions.undoSaveDayAsTemplate({ templateId: id(900), restoreId: null, link: { programId, dayIndex: 2, previousTemplateId: null } });
  await templateActions.undoSaveDayAsTemplate({ templateId: id(900), restoreId: null, link: { programId, dayIndex: 2, previousTemplateId: "bad" } });
  assert.equal(currentDb.log.filter((q) => q.table === "program_days").length, 0);

  // A failing restore is logged and does not fail the undo.
  await quietly(async (logged) => {
    currentDb = makeDb({ rpc, programDayError: { code: "XX000", message: "private" } });
    assert.deepEqual(await templateActions.undoSaveDayAsTemplate({ templateId: id(900), restoreId: null, link: { programId, dayIndex: 2, previousTemplateId: id(1) } }), { ok: true });
    assert.equal(logged.length, 1);
  });
});

test("updateSavedDay sends the cleaned exercises to update_day_template and returns the kept row's id", async () => {
  const staffBefore = staffCalls;
  currentDb = makeDb({ rpc: async () => ({ data: id(950), error: null }) });
  const res = await templateActions.updateSavedDay({
    id: id(1),
    exercises: [
      ex("Press", { sets: "4", reps: undefined }),
      ex("   "),
      ex("Row", { reps: "  10  ", saveToLibrary: true }),
      ex("Dip", { library_id: id(77), saveToLibrary: true }),
    ],
  });
  assert.deepEqual(res, { ok: true, archivedId: id(950) });
  const call = currentDb.log.find((q) => q.rpc);
  assert.equal(call.rpc, "update_day_template");
  assert.equal(call.args.p_id, id(1));
  assert.deepEqual(call.args.p_exercises.map((e) => [e.name, e.sets, e.reps, e.saveToLibrary, e.library_id]), [
    ["Press", 4, null, false, null],
    ["Row", 3, "10", true, null],
    ["Dip", 3, "8-12", false, id(77)],
  ]);
  assert.ok(revalidated.some(([p]) => p === "/admin/programs"));
  assert.ok(staffCalls > staffBefore, "the action is staff-gated");
});

test("updateSavedDay refuses bad input before any write, in the viewer's language", async () => {
  for (const l of ["en", "tr"]) {
    lang = l;
    currentDb = makeDb({ rpc: async () => ({ data: id(950), error: null }) });
    assert.deepEqual(await templateActions.updateSavedDay({ id: "nope", exercises: [ex("Press")] }), { ok: false, error: t(l, "sd.notFound") });
    assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: [ex("  ")] }), { ok: false, error: t(l, "sd.emptyDay") });
    assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: "nope" }), { ok: false, error: t(l, "sd.emptyDay") });
    const tooMany = Array.from({ length: 201 }, (_, i) => ex(`Exercise ${i}`));
    assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: tooMany }), { ok: false, error: t(l, "sd.tooManyExercises", { max: 200 }) });
    assert.equal(currentDb.log.length, 0, "nothing reached the database");
  }
  lang = "en";
});

test("updateSavedDay maps the database's answers to localized messages", async () => {
  await quietly(async () => {
    for (const l of ["en", "tr"]) {
      lang = l;
      currentDb = makeDb({ rpc: async (name) => ({ data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}(p_id, p_exercises) in the schema cache` } }) });
      assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: [ex("Press")] }), { ok: false, error: t(l, "sd.needsMigration22") });
    }
    lang = "en";
    assert.match(t("en", "sd.needsMigration22"), /0022/);
    assert.match(t("tr", "sd.needsMigration22"), /0022/);
    assert.notEqual(t("tr", "sd.needsMigration22"), t("en", "sd.needsMigration22"));

    currentDb = makeDb({ rpc: async () => ({ data: null, error: { code: "P0002", message: "day_template_not_found" } }) });
    assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: [ex("Press")] }), { ok: false, error: t("en", "sd.notFound") });

    currentDb = makeDb({ rpc: async () => ({ data: null, error: { code: "XX000", message: "private detail" } }) });
    assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: [ex("Press")] }), { ok: false, error: t("en", "sd.updateError") }, "database details never reach the UI");

    currentDb = makeDb({ rpc: async () => ({ data: null, error: null }) });
    assert.deepEqual(await templateActions.updateSavedDay({ id: id(1), exercises: [ex("Press")] }), { ok: false, error: t("en", "sd.updateError") }, "no id back is a failure");
  });
});

test("undoUpdateSavedDay calls revert_day_template_update with both ids and maps the answers", async () => {
  await quietly(async () => {
    currentDb = makeDb({ rpc: async () => ({ data: null, error: null }) });
    assert.deepEqual(await templateActions.undoUpdateSavedDay({ id: id(1), archivedId: id(950) }), { ok: true });
    assert.deepEqual(currentDb.log.find((q) => q.rpc), { rpc: "revert_day_template_update", args: { p_id: id(1), p_archive_id: id(950) } });

    assert.deepEqual(await templateActions.undoUpdateSavedDay({ id: "bad", archivedId: id(950) }), { ok: false, error: t("en", "sd.undoError") });

    currentDb = makeDb({ rpc: async (name) => ({ data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } }) });
    assert.deepEqual(await templateActions.undoUpdateSavedDay({ id: id(1), archivedId: id(950) }), { ok: false, error: t("en", "sd.needsMigration22") });

    currentDb = makeDb({ rpc: async () => ({ data: null, error: { code: "P0002", message: "day_template_restore_not_found" } }) });
    assert.deepEqual(await templateActions.undoUpdateSavedDay({ id: id(1), archivedId: id(950) }), { ok: false, error: t("en", "sd.undoError") });

    currentDb = makeDb({ rpc: async () => ({ data: null, error: { code: "XX000", message: "private detail" } }) });
    assert.deepEqual(await templateActions.undoUpdateSavedDay({ id: id(1), archivedId: id(950) }), { ok: false, error: t("en", "sd.undoError") });
  });
});

test("the Update saved day strings exist in English and Turkish", () => {
  const keys = [
    "sd.update", "sd.updateLabel", "sd.updateTitle", "sd.updateSubtitle", "sd.updateAdded", "sd.updateRemoved",
    "sd.updateChanged", "sd.updateReordered", "sd.updateNoChanges", "sd.change.name", "sd.change.dose", "sd.change.cues",
    "sd.change.video", "sd.change.link", "sd.updatePrevious", "sd.updateProgrammes", "sd.updateButton", "sd.updating",
    "sd.updatedToast", "sd.updateUndone", "sd.updateError", "sd.needsMigration22", "sd.notFound", "sd.undo", "sd.undoError",
    "sd.andMore", "common.cancel",
  ];
  for (const l of ["en", "tr"]) {
    for (const k of keys) assert.notEqual(t(l, k), k, `${l} ${k}`);
  }
});

test("the UI and the migration are wired to the same contract", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, rel), "utf8");
  const migration = read("../supabase/migrations/0022_saved_day_updates.sql");
  assert.match(migration, /create or replace function public\.update_day_template\(p_id uuid, p_exercises jsonb\)/);
  assert.match(migration, /create or replace function public\.revert_day_template_update\(p_id uuid, p_archive_id uuid\)/);
  assert.match(migration, /add column if not exists source_template_id uuid/);

  const dialog = read("../src/app/admin/update-saved-day-dialog.tsx");
  assert.match(dialog, /savedDayDiff\(savedDay\.exercises, day\.exercises\)/);
  assert.match(dialog, /updateSavedDay\(\{\s*id: savedDay\.id,/);
  assert.match(dialog, /undoUpdateSavedDay\(\{ id: savedDay\.id, archivedId \}\)/);
  assert.match(dialog, /SavedDayModal, SavedDayModalHeader/);

  const header = read("../src/app/admin/editor/day-header.tsx");
  assert.match(header, /updateTargetName && onUpdateSavedDay/);
  assert.match(header, /col-span-3 justify-center sm:col-span-1/);
  assert.match(header, /grid-flow-dense/);

  const editor = read("../src/app/admin/program-editor.tsx");
  assert.match(editor, /!saveDayKey && !insertOpen && !updateOpen/);
  assert.match(editor, /currentId && !isTemplate && !dirty && saveDay/, "linked only when saved and clean");
  assert.match(editor, /savedDayById\(selectedDay\.sourceTemplateId\)/);

  const templates = read("../src/lib/templates.ts");
  assert.match(templates, /"update_day_template" \| "revert_day_template_update"/);
});
