/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const sd = require("../src/lib/saved-days.ts");
const { t } = require("../src/lib/i18n.ts");

// Made-up people and ids only.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tpl = (n, title, extra = {}) => ({
  id: id(n), title, created_at: "2026-09-01T08:00:00.000Z", updated_at: "2026-09-02T08:00:00.000Z",
  deleted_at: null, source_label: null, exercises: [], ...extra,
});
const ex = (name, extra = {}) => ({ name, sets: 3, reps: "8-12", instructions: "Goal: test\n\n* Cue", media_url: null, library_id: null, ...extra });

// ---------------------------------------------------------------------------
// Copy semantics
// ---------------------------------------------------------------------------

test("a saved day inserted into a programme is a deep copy in both directions", () => {
  const saved = tpl(1, "Push Day", { exercises: [
    { id: id(11), template_id: id(1), name: "Row", sets: 2, reps: "10", instructions: "B", media_url: null, library_id: null, order_index: 1 },
    { id: id(10), template_id: id(1), name: "Press", sets: 3, reps: "8-12", instructions: "A", media_url: "https://youtu.be/x", library_id: id(99), order_index: 0 },
  ] });
  const day = sd.savedDayToEditorDay(saved);
  assert.equal(day.title, "Push Day");
  assert.equal(day.sourceTemplateLabel, "Push Day", "the origin is recorded");
  assert.deepEqual(day.exercises.map((e) => e.name), ["Press", "Row"], "ordered by order_index");
  assert.deepEqual(Object.keys(day.exercises[0]).sort(), ["instructions", "library_id", "media_url", "name", "reps", "sets"], "no row ids leak into the copy");

  day.exercises[0].sets = 99; day.exercises.push(ex("Extra")); day.title = "Changed";
  assert.equal(saved.exercises[1].sets, 3); assert.equal(saved.exercises.length, 2); assert.equal(saved.title, "Push Day");
  saved.exercises[0].name = "Edited later";
  assert.equal(day.exercises[1].name, "Row", "editing the saved day never changes the programme day");
});

test("saving a programme day copies only named exercises and never shares objects", () => {
  const day = { title: "Day 1", sourceTemplateLabel: null, exercises: [ex(" Squat "), ex("   "), ex("Lunge", { sets: 1 })] };
  const saved = sd.editorDayToSavedExercises(day);
  assert.deepEqual(saved.map((e) => e.name), ["Squat", "Lunge"]);
  saved[0].reps = "changed"; day.exercises[2].sets = 7;
  assert.equal(day.exercises[0].reps, "8-12"); assert.equal(saved[1].sets, 1);
  assert.deepEqual(sd.savableExercises([ex(""), ex(" ")]), [], "an empty day has nothing to save");
});

test("inserting appends a new last day and leaves existing days deep-equal", () => {
  const days = [
    { title: "Mobility", sourceTemplateLabel: null, exercises: [ex("Cat-cow")] },
    { title: "Strength", sourceTemplateLabel: "Old saved day", exercises: [ex("Deadlift"), ex("Carry")] },
  ];
  const before = structuredClone(days);
  const saved = tpl(2, "Pull Day", { exercises: [{ id: id(20), template_id: id(2), name: "Chin-up", sets: 3, reps: "5", instructions: null, media_url: null, library_id: null, order_index: 0 }] });
  const next = [...days, sd.savedDayToEditorDay(saved)];
  assert.equal(next.length, 3);
  assert.deepEqual(next.slice(0, 2), before);
  assert.equal(next[2].title, "Pull Day"); assert.equal(next[2].sourceTemplateLabel, "Pull Day");
  next[2].exercises[0].name = "Edited";
  assert.equal(saved.exercises[0].name, "Chin-up");
});

// ---------------------------------------------------------------------------
// Names, conflicts, purge dates
// ---------------------------------------------------------------------------

test("name conflicts are case-insensitive, whitespace-tolerant, Turkish-İ aware and ignore deleted rows", () => {
  const saved = [tpl(1, "Push Day"), tpl(2, "İtme Günü"), tpl(3, "Pull Day", { deleted_at: "2026-09-10T00:00:00Z" })];
  assert.equal(sd.findSavedDayConflict("  push   DAY ", saved)?.id, id(1));
  assert.equal(sd.findSavedDayConflict("itme günü", saved)?.id, id(2));
  assert.equal(sd.findSavedDayConflict("İTME GÜNÜ", saved)?.id, id(2));
  assert.equal(sd.findSavedDayConflict("Pull Day", saved), null, "deleted rows never conflict");
  assert.equal(sd.findSavedDayConflict("Push Day", saved, id(1)), null, "the row being renamed is excluded");
  assert.equal(sd.findSavedDayConflict("   ", saved), null);
});

test("a name change must be free, but keeping a (legacy duplicate) name is never blocked", () => {
  const saved = [tpl(1, "Push Day"), tpl(2, "push day"), tpl(3, "Legs"), tpl(4, "Old", { deleted_at: "2026-09-10T00:00:00Z" })];
  assert.equal(sd.findSavedDayNameChangeConflict("PUSH DAY", saved)?.id, id(1), "a new saved day may not take a live name");
  assert.equal(sd.findSavedDayNameChangeConflict("Push Day", saved, id(3))?.id, id(1), "renaming onto a live name is blocked");
  assert.equal(sd.findSavedDayNameChangeConflict("Push Day", saved, id(2)), null, "a legacy duplicate keeps its name");
  assert.equal(sd.findSavedDayNameChangeConflict(" PUSH  day ", saved, id(1)), null, "re-spelling the own name is fine");
  assert.equal(sd.findSavedDayNameChangeConflict("Old", saved, id(3)), null, "deleted names are free");
  assert.equal(sd.findSavedDayNameChangeConflict("Legs", saved, id(4))?.id, id(3), "a non-live own row does not exempt the name");
});

test("the Save day dialog's Replace choice only applies to the saved day it was picked for", () => {
  const start = { mode: "copy", forId: null };
  assert.equal(sd.saveDayChoiceFor(start, null), start, "no conflict: unchanged");
  assert.deepEqual(sd.saveDayChoiceFor(start, id(1)), { mode: "copy", forId: id(1) }, "a new conflict starts at copy");
  const replaceA = { mode: "replace", forId: id(1) };
  assert.equal(sd.saveDayChoiceFor(replaceA, id(1)), replaceA, "same conflict keeps Replace");
  assert.deepEqual(sd.saveDayChoiceFor(replaceA, id(2)), { mode: "copy", forId: id(2) }, "another conflict resets to copy");
  assert.deepEqual(sd.saveDayChoiceFor(replaceA, undefined), { mode: "copy", forId: null }, "no conflict resets to copy");
  // A → B → A: the reset is stored, so coming back to A does not bring Replace back.
  const backToA = sd.saveDayChoiceFor(sd.saveDayChoiceFor(replaceA, id(2)), id(1));
  assert.deepEqual(backToA, { mode: "copy", forId: id(1) });
  const src = fs.readFileSync(path.join(__dirname, "../src/app/admin/save-day-dialog.tsx"), "utf8");
  assert.match(src, /saveDayChoiceFor\(rawChoice, conflict\?\.id\)/);
  assert.match(src, /replaceId: conflict && choice === "replace" \? conflict\.id : null/);
});

test("copy names continue the sequence and respect the length cap", () => {
  assert.equal(sd.nextCopyName("Push Day", ["Push Day"]), "Push Day (2)");
  assert.equal(sd.nextCopyName("push day", ["Push Day", "PUSH DAY (2)"]), "push day (3)");
  assert.equal(sd.nextCopyName("Push Day (2)", ["Push Day", "Push Day (2)"]), "Push Day (3)", "never 'Push Day (2) (2)'");
  assert.equal(sd.nextCopyName("İtme Günü", ["itme günü", "İtme Günü (2)"]), "İtme Günü (3)");
  const long = "x".repeat(300);
  const copy = sd.nextCopyName(long, [long], sd.SAVED_DAY_TITLE_MAX);
  assert.equal(copy.length, 300); assert.ok(copy.endsWith(" (2)"));
});

test("deleted saved days are kept 30 days, then expire", () => {
  assert.equal(sd.SAVED_DAY_RETENTION_DAYS, 30);
  const deletedAt = "2026-09-01T10:00:00.000Z";
  assert.equal(sd.savedDayPurgeDate(deletedAt).toISOString(), "2026-10-01T10:00:00.000Z");
  assert.equal(sd.isSavedDayExpired(deletedAt, new Date("2026-10-01T09:59:59.999Z")), false);
  assert.equal(sd.isSavedDayExpired(deletedAt, new Date("2026-10-01T10:00:00.000Z")), true);
  assert.equal(sd.savedDayPurgeCutoff(new Date("2026-10-31T00:00:00.000Z")).toISOString(), "2026-10-01T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// A small in-memory PostgREST stand-in. `migrated: false` behaves like the
// database before 0021: the new columns and RPCs do not exist.
// ---------------------------------------------------------------------------

function makeDb({ templates = [], migrated = true, days = [], exercises = [], rpc } = {}) {
  const log = [];
  let seq = 500;
  const state = { templates: structuredClone(templates) };
  const NEW_COLS = /deleted_at|updated_at|source_label/;
  const missing = (col, table = "day_templates") => ({ data: null, error: { code: "42703", message: `column ${table}.${col} does not exist` } });

  function matches(row, filters) {
    return filters.every(([op, key, a, b]) => {
      if (op === "eq") return row[key] === a;
      if (op === "is") return (row[key] ?? null) === a;
      if (op === "not") return a === "is" && b === null ? row[key] != null : true;
      if (op === "lte") return row[key] != null && row[key] <= a;
      return true;
    });
  }

  function handle(q) {
    if (q.table === "program_days") {
      if (!migrated && /source_template_label/.test(q.cols)) return missing("source_template_label", "program_days");
      return { data: days.map((d) => (/source_template_label/.test(q.cols) ? d : { ...d, source_template_label: undefined })), error: null };
    }
    if (q.table === "exercises") return { data: exercises, error: null };
    if (q.table === "day_template_exercises") return { data: null, error: null };
    if (q.table !== "day_templates") return { data: null, error: null };
    const usesNew = q.filters.some(([, key]) => NEW_COLS.test(key)) || NEW_COLS.test(q.cols ?? "")
      || (q.payload && !Array.isArray(q.payload) && Object.keys(q.payload).some((k) => NEW_COLS.test(k)));
    if (!migrated && usesNew) {
      return q.op === "select" ? missing("deleted_at")
        : { data: null, error: { code: "PGRST204", message: "Could not find the 'deleted_at' column of 'day_templates' in the schema cache" } };
    }
    if (q.op === "insert") {
      const row = { id: id(++seq), created_at: "2026-10-02T00:00:00.000Z", deleted_at: null, ...q.payload };
      state.templates.push(row);
      return { data: { id: row.id }, error: null };
    }
    const rows = state.templates.filter((r) => matches(r, q.filters));
    if (q.op === "update") { for (const r of rows) Object.assign(r, q.payload); }
    if (q.op === "delete") { state.templates = state.templates.filter((r) => !rows.includes(r)); }
    const shaped = rows.map((r) => {
      const out = { id: r.id, title: r.title, created_at: r.created_at };
      if (migrated) Object.assign(out, { updated_at: r.updated_at ?? r.created_at, deleted_at: r.deleted_at ?? null, source_label: r.source_label ?? null });
      if (/day_template_exercises\(count\)/.test(q.cols ?? "")) out.day_template_exercises = [{ count: (r.exercises ?? []).length }];
      else if (/day_template_exercises\(id/.test(q.cols ?? "")) out.day_template_exercises = structuredClone(r.exercises ?? []);
      return out;
    });
    if (q.single) return { data: shaped[0] ?? null, error: null };
    return { data: shaped.slice(q.range?.[0] ?? 0, (q.range?.[1] ?? 1e9) + 1), error: null };
  }

  return {
    log, state,
    from(table) {
      const q = { table, op: "select", filters: [], payload: null, cols: null };
      log.push(q);
      const resolve = () => Promise.resolve(handle(q));
      const b = {
        select(cols) { if (q.op === "select") q.cols = cols; return b; },
        insert(p) { q.op = "insert"; q.payload = p; return b; },
        update(p) { q.op = "update"; q.payload = p; return b; },
        delete() { q.op = "delete"; return b; },
        eq(k, v) { q.filters.push(["eq", k, v]); return b; },
        is(k, v) { q.filters.push(["is", k, v]); return b; },
        not(k, o, v) { q.filters.push(["not", k, o, v]); return b; },
        lte(k, v) { q.filters.push(["lte", k, v]); return b; },
        order() { return b; },
        range(a, z) { q.range = [a, z]; return b; },
        returns() { return b; },
        maybeSingle() { q.single = true; return resolve(); },
        single() { q.single = true; return resolve(); },
        then(onOk, onErr) { return resolve().then(onOk, onErr); },
      };
      return b;
    },
    async rpc(name, args) {
      log.push({ rpc: name, args });
      if (!migrated) return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}(...) in the schema cache` } };
      return rpc ? rpc(name, args) : { data: id(900), error: null };
    },
  };
}

// Load the server actions with requireStaff / getLang / revalidatePath mocked.
let currentDb = null;
let lang = "en";
let staffCalls = 0;
const revalidated = [];
const original = Module._load;
Module._load = function (request, parent, main) {
  if (request === "@/lib/admin-auth") return { requireStaff: async () => { staffCalls++; return { supabase: currentDb }; } };
  if (request === "@/lib/i18n-server") return { getLang: async () => lang };
  if (request === "next/cache") return { revalidatePath: (...args) => revalidated.push(args) };
  return original.call(this, request, parent, main);
};
const actions = require("../src/app/admin/template-actions.ts");
Module._load = original;
const templates = require("../src/lib/templates.ts");
const { loadEditorDays } = require("../src/lib/program-editor-loader.ts");
const quiet = (fn) => async () => { const log = console.error; console.error = () => {}; try { await fn(); } finally { console.error = log; } };
const rpcCalls = (db) => db.log.filter((q) => q.rpc);

test("saveDayAsTemplate auto-names a same-name save as the next copy and records the source", async () => {
  lang = "en";
  currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(2, "push day (2)"), tpl(3, "Pull Day", { deleted_at: "2026-09-20T00:00:00Z" })] });
  const res = await actions.saveDayAsTemplate({ title: " PUSH  DAY ", exercises: [ex("Press"), ex("  ")], sourceLabel: " Test Kaya · Oct 2026 " });
  assert.equal(res.ok, true);
  assert.equal(res.title, "PUSH DAY (3)"); assert.equal(res.replacedId, null); assert.equal(res.templateId, id(900));
  const [call] = rpcCalls(currentDb);
  assert.equal(call.rpc, "save_day_template");
  assert.equal(call.args.p_id, null); assert.equal(call.args.p_title, "PUSH DAY (3)"); assert.equal(call.args.p_replace_id, null);
  assert.equal(call.args.p_source_label, "Test Kaya · Oct 2026");
  assert.deepEqual(call.args.p_exercises.map((e) => e.name), ["Press"], "blank rows are dropped");

  currentDb = makeDb({ templates: [tpl(3, "Pull Day", { deleted_at: "2026-09-20T00:00:00Z" })] });
  const fresh = await actions.saveDayAsTemplate({ title: "Pull Day", exercises: [ex("Row")], sourceLabel: null });
  assert.equal(fresh.title, "Pull Day", "a deleted saved day does not block the name");
  assert.ok(revalidated.some(([p]) => p === "/admin/programs"));
});

test("saveDayAsTemplate replace passes p_replace_id only for the live same-name row", async () => {
  currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(4, "Legs")] });
  const res = await actions.saveDayAsTemplate({ title: "push day", exercises: [ex("Press")], sourceLabel: null, replaceId: id(1) });
  assert.equal(res.ok, true); assert.equal(res.replacedId, id(1)); assert.equal(res.title, "push day");
  assert.equal(rpcCalls(currentDb)[0].args.p_replace_id, id(1));

  currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(4, "Legs")] });
  const wrong = await actions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, replaceId: id(4) });
  assert.equal(wrong.replacedId, null); assert.equal(wrong.title, "Push Day (2)", "a non-matching replace falls back to a copy");
  assert.equal(rpcCalls(currentDb)[0].args.p_replace_id, null);
});

test("empty days and blank names are rejected before any write, in the viewer's language", async () => {
  for (const l of ["en", "tr"]) {
    lang = l;
    currentDb = makeDb({ templates: [] });
    const empty = await actions.saveDayAsTemplate({ title: "Day 1", exercises: [ex("  ")], sourceLabel: null });
    assert.deepEqual(empty, { ok: false, error: t(l, "sd.emptyDay") });
    const blank = await actions.saveDayAsTemplate({ title: "  ", exercises: [ex("Press")], sourceLabel: null });
    assert.deepEqual(blank, { ok: false, error: t(l, "sd.nameRequired") });
    const editorEmpty = await actions.saveTemplate({ title: "Day", exercises: [] });
    assert.deepEqual(editorEmpty, { ok: false, error: t(l, "sd.emptyDay") });
    assert.equal(currentDb.log.length, 0, "nothing reached the database");
  }
  lang = "en";
});

test("the server maps a replaced-meanwhile row (P0002) to a localized not-found error", quiet(async () => {
  currentDb = makeDb({ templates: [tpl(1, "Push Day")], rpc: () => ({ data: null, error: { code: "P0002", message: "day_template_replace_not_found" } }) });
  const res = await actions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, replaceId: id(1) });
  assert.deepEqual(res, { ok: false, error: t("en", "sd.notFound") });
  currentDb = makeDb({ templates: [], rpc: () => ({ data: null, error: { code: "XX000", message: "private detail" } }) });
  const other = await actions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null });
  assert.deepEqual(other, { ok: false, error: t("en", "sd.saveError") }, "database details never reach the UI");
}));

test("undo calls the atomic revert RPC with the created and replaced ids", async () => {
  currentDb = makeDb({ rpc: () => ({ data: null, error: null }) });
  assert.deepEqual(await actions.undoSaveDayAsTemplate({ templateId: id(900), restoreId: id(1) }), { ok: true });
  assert.deepEqual(rpcCalls(currentDb)[0], { rpc: "revert_day_template_save", args: { p_created_id: id(900), p_restore_id: id(1) } });
  assert.equal((await actions.undoSaveDayAsTemplate({ templateId: "not-a-uuid", restoreId: null })).ok, false);
});

test("deleteSavedDay soft-deletes a live row (update deleted_at, never .delete()) and restore brings it back", async () => {
  currentDb = makeDb({ templates: [tpl(1, "Push Day")] });
  assert.deepEqual(await actions.deleteSavedDay({ id: id(1) }), { ok: true });
  const del = currentDb.log.find((q) => q.table === "day_templates" && q.op === "update");
  assert.ok(Date.parse(del.payload.deleted_at) > 0);
  assert.deepEqual(del.filters, [["eq", "id", id(1)], ["is", "deleted_at", null]]);
  assert.equal(currentDb.log.some((q) => q.op === "delete"), false);
  assert.deepEqual(await actions.deleteSavedDay({ id: id(1) }), { ok: false, error: t("en", "sd.notFound") }, "already deleted");

  const restored = await actions.restoreSavedDay({ id: id(1) });
  assert.deepEqual(restored, { ok: true, title: "Push Day" });
  assert.equal(currentDb.state.templates[0].deleted_at, null);

  // A live row took the name meanwhile → it comes back as the next copy name.
  currentDb = makeDb({ templates: [tpl(1, "Push Day", { deleted_at: "2026-09-20T00:00:00Z" }), tpl(2, "push day")] });
  const renamed = await actions.restoreSavedDay({ id: id(1) });
  assert.deepEqual(renamed, { ok: true, title: "Push Day (2)" });
  assert.equal(currentDb.state.templates[0].title, "Push Day (2)");
});

test("renameSavedDay validates, refuses a taken live name and renames live rows only", async () => {
  currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(2, "Legs"), tpl(3, "Old", { deleted_at: "2026-09-20T00:00:00Z" })] });
  assert.deepEqual(await actions.renameSavedDay({ id: id(1), title: "  " }), { ok: false, error: t("en", "sd.nameRequired") });
  assert.deepEqual(await actions.renameSavedDay({ id: id(1), title: "x".repeat(301) }), { ok: false, error: t("en", "sd.nameTooLong", { max: 300 }) });
  assert.deepEqual(await actions.renameSavedDay({ id: id(1), title: "LEGS" }), { ok: false, error: t("en", "sd.nameTaken", { name: "LEGS" }) });
  assert.deepEqual(await actions.renameSavedDay({ id: id(1), title: "Old" }), { ok: true, title: "Old" }, "deleted names are free");
  assert.deepEqual(await actions.renameSavedDay({ id: id(3), title: "Back" }), { ok: false, error: t("en", "sd.notFound") });
  assert.equal(currentDb.state.templates[0].title, "Old");
  assert.ok(staffCalls > 10, "every action is staff-gated");
});

test("purge removes rows deleted 30+ days ago, ignores errors and is a no-op before 0021", quiet(async () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  currentDb = makeDb({ templates: [
    tpl(1, "Old", { deleted_at: "2026-09-30T12:00:00.000Z" }),
    tpl(2, "Recent", { deleted_at: "2026-10-15T00:00:00.000Z" }),
    tpl(3, "Live"),
  ] });
  await templates.purgeExpiredSavedDays(currentDb, now);
  const q = currentDb.log.find((x) => x.op === "delete");
  assert.deepEqual(q.filters, [["lte", "deleted_at", "2026-10-01T12:00:00.000Z"]]);
  assert.deepEqual(currentDb.state.templates.map((r) => r.title), ["Recent", "Live"]);

  currentDb = makeDb({ templates: [tpl(1, "Live")], migrated: false });
  await templates.purgeExpiredSavedDays(currentDb, now);
  assert.equal(currentDb.state.templates.length, 1);
  const failing = { from() { throw new Error("offline"); } };
  await templates.purgeExpiredSavedDays(failing, now);
}));

test("loaders: live/deleted split with counts; picker and single load are live-only", async () => {
  currentDb = makeDb({ templates: [
    tpl(1, "Push Day", { source_label: "Test Kaya · Oct 2026", exercises: [{ id: id(12), template_id: id(1), name: "B", order_index: 1 }, { id: id(11), template_id: id(1), name: "A", order_index: 0 }] }),
    tpl(2, "Gone", { deleted_at: "2026-09-20T00:00:00Z" }),
  ] });
  const { live, deleted, migrated } = await templates.loadSavedDays(currentDb);
  assert.equal(migrated, true);
  assert.deepEqual(live.map((r) => [r.title, r.count, r.source_label]), [["Push Day", 2, "Test Kaya · Oct 2026"]]);
  assert.deepEqual(deleted.map((r) => r.title), ["Gone"]);
  const picker = await templates.loadTemplatesForPicker(currentDb);
  assert.deepEqual(picker.map((r) => r.title), ["Push Day"]);
  assert.deepEqual(picker[0].exercises.map((e) => e.name), ["A", "B"]);
  assert.equal((await templates.loadTemplate(currentDb, id(1)))?.title, "Push Day");
  assert.equal(await templates.loadTemplate(currentDb, id(2)), null, "a deleted saved day cannot be opened");
  assert.equal(await templates.loadTemplate(currentDb, "nope"), null);
});

test("compat before 0021: loaders fall back to legacy columns and treat every row as live", async () => {
  currentDb = makeDb({ migrated: false, templates: [tpl(1, "Push Day", { exercises: [{ id: id(11), template_id: id(1), name: "A", order_index: 0 }] })] });
  const { live, deleted, migrated } = await templates.loadSavedDays(currentDb);
  assert.equal(migrated, false); assert.deepEqual(deleted, []);
  assert.equal(live[0].updated_at, live[0].created_at); assert.equal(live[0].source_label, null); assert.equal(live[0].deleted_at, null);
  assert.equal(live[0].count, 1);
  assert.equal((await templates.loadTemplatesForPicker(currentDb))[0].exercises.length, 1);
  assert.equal((await templates.loadTemplate(currentDb, id(1)))?.title, "Push Day");
});

test("compat before 0021: saving uses the sequential path; replace / delete need the migration", quiet(async () => {
  currentDb = makeDb({ migrated: false, templates: [tpl(1, "Push Day")] });
  const copy = await actions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press"), ex("Row")], sourceLabel: "Test Kaya" });
  assert.equal(copy.ok, true); assert.equal(copy.title, "Push Day (2)");
  const inserts = currentDb.log.filter((q) => q.op === "insert");
  assert.deepEqual(inserts.map((q) => q.table), ["day_templates", "day_template_exercises"]);
  assert.deepEqual(inserts[0].payload, { title: "Push Day (2)" }, "no 0021 columns are written");
  assert.deepEqual(inserts[1].payload.map((r) => [r.name, r.order_index]), [["Press", 0], ["Row", 1]]);

  const replace = await actions.saveDayAsTemplate({ title: "Push Day", exercises: [ex("Press")], sourceLabel: null, replaceId: id(1) });
  assert.deepEqual(replace, { ok: false, error: t("en", "sd.needsMigration") });
  assert.deepEqual(await actions.deleteSavedDay({ id: id(1) }), { ok: false, error: t("en", "sd.needsMigration") });

  currentDb = makeDb({ migrated: false, templates: [tpl(1, "Push Day")] });
  const edit = await actions.saveTemplate({ id: id(1), title: "Push Day v2", exercises: [ex("Press")] });
  assert.deepEqual(edit, { ok: true, templateId: id(1) });
  assert.equal(currentDb.state.templates[0].title, "Push Day v2");

  currentDb = makeDb({ migrated: false, templates: [tpl(1, "Push Day")] });
  assert.deepEqual(await actions.undoSaveDayAsTemplate({ templateId: id(1), restoreId: null }), { ok: true });
  assert.equal(currentDb.state.templates.length, 0, "undo of a plain save deletes the created row");
  assert.deepEqual(await actions.undoSaveDayAsTemplate({ templateId: id(1), restoreId: id(2) }), { ok: false, error: t("en", "sd.needsMigration") });
}));

test("saveTemplate (saved-day editor) saves atomically via the RPC without a source label", async () => {
  currentDb = makeDb({ templates: [] });
  const res = await actions.saveTemplate({ title: " Knee Rehab ", exercises: [ex("Bridge", { saveToLibrary: true }), ex("Clam", { library_id: id(77), saveToLibrary: true })] });
  assert.deepEqual(res, { ok: true, templateId: id(900) });
  const { args } = rpcCalls(currentDb)[0];
  assert.deepEqual([args.p_id, args.p_title, args.p_source_label, args.p_replace_id], [null, "Knee Rehab", null, null]);
  assert.deepEqual(args.p_exercises.map((e) => e.saveToLibrary), [true, false], "only unlinked rows are saved to the library");
});

test("saveTemplate refuses a new or changed name a live saved day already uses, but legacy duplicates stay saveable", async () => {
  for (const l of ["en", "tr"]) {
    lang = l;
    currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(3, "Legs"), tpl(4, "Old", { deleted_at: "2026-09-10T00:00:00Z" })] });
    const created = await actions.saveTemplate({ title: " push  DAY ", exercises: [ex("Press")] });
    assert.deepEqual(created, { ok: false, error: t(l, "sd.nameTaken", { name: "push DAY" }) });
    const renamed = await actions.saveTemplate({ id: id(3), title: "PUSH DAY", exercises: [ex("Squat")] });
    assert.deepEqual(renamed, { ok: false, error: t(l, "sd.nameTaken", { name: "PUSH DAY" }) });
    assert.equal(rpcCalls(currentDb).length, 0, "nothing was written");
  }
  lang = "en";

  // A legacy duplicate (two live "Push Day" rows from the old editor).
  currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(2, "push day"), tpl(4, "Old", { deleted_at: "2026-09-10T00:00:00Z" })] });
  assert.deepEqual(await actions.saveTemplate({ id: id(2), title: "push day", exercises: [ex("Press")] }), { ok: true, templateId: id(900) },
    "re-saving a legacy duplicate under its own name still works");
  assert.deepEqual(await actions.saveTemplate({ id: id(1), title: "Push Day v2", exercises: [ex("Press")] }), { ok: true, templateId: id(900) });
  assert.deepEqual(await actions.saveTemplate({ title: "Old", exercises: [ex("Press")] }), { ok: true, templateId: id(900) }, "deleted names are free");
  assert.equal(rpcCalls(currentDb).length, 3);

  // renameSavedDay follows the same rule.
  currentDb = makeDb({ templates: [tpl(1, "Push Day"), tpl(2, "push day")] });
  assert.deepEqual(await actions.renameSavedDay({ id: id(2), title: "PUSH DAY" }), { ok: true, title: "PUSH DAY" });
});

test("loadSavedDaysForEditor reports a failed load instead of looking like 'no saved days yet'", quiet(async () => {
  currentDb = makeDb({ templates: [tpl(1, "Push Day")] });
  const loaded = await templates.loadSavedDaysForEditor(currentDb);
  assert.equal(loaded.savedDaysFailed, false); assert.deepEqual(loaded.savedDays.map((d) => d.title), ["Push Day"]);
  const empty = await templates.loadSavedDaysForEditor(makeDb({ templates: [] }));
  assert.deepEqual(empty, { savedDays: [], savedDaysFailed: false }, "a genuinely empty list is not a failure");
  const broken = {
    from() {
      const b = new Proxy({}, { get: (_, k) => (k === "then"
        ? (ok) => Promise.resolve({ data: null, error: { code: "42501", message: "permission denied" } }).then(ok)
        : () => b) });
      return b;
    },
  };
  assert.deepEqual(await templates.loadSavedDaysForEditor(broken), { savedDays: [], savedDaysFailed: true });
  assert.deepEqual(await templates.loadTemplatesForPicker(broken), [], "the legacy loader keeps its shape");
  const offline = { from() { throw new Error("offline"); } };
  assert.deepEqual(await templates.loadSavedDaysForEditor(offline), { savedDays: [], savedDaysFailed: true });
  const dialog = fs.readFileSync(path.join(__dirname, "../src/app/admin/insert-saved-day-dialog.tsx"), "utf8");
  assert.match(dialog, /live\.length === 0 && loadFailed \?/, "the dialog shows the load error before the empty state");
  for (const l of ["en", "tr"]) {
    assert.notEqual(t(l, "sd.loadFailed"), "sd.loadFailed"); assert.notEqual(t(l, "sd.tryAgain"), "sd.tryAgain");
  }
}));

test("loadEditorDays carries the origin label, strips row ids and works before 0021", async () => {
  const days = [{ id: "d1", program_id: "p", title: "Push Day", order_index: 0, source_template_label: "Push Day" }, { id: "d2", program_id: "p", title: null, order_index: 1, source_template_label: null }];
  const rows = [{ id: "e1", program_id: "p", day_id: "d1", name: "Press", sets: 3, reps: "8", instructions: null, media_url: null, library_id: null, order_index: 0 },
    { id: "e2", program_id: "p", day_id: null, name: "Walk", sets: null, reps: null, instructions: null, media_url: null, library_id: null, order_index: 1 }];
  const loaded = await loadEditorDays(makeDb({ days, exercises: rows }), "p", "Other");
  assert.deepEqual(loaded.map((d) => [d.title, d.sourceTemplateLabel]), [["Push Day", "Push Day"], ["", null], ["Other", null]]);
  assert.deepEqual(Object.keys(loaded[0].exercises[0]).sort(), ["instructions", "library_id", "media_url", "name", "reps", "sets"]);
  const legacy = await loadEditorDays(makeDb({ days, exercises: rows, migrated: false }), "p", "Other");
  assert.deepEqual(legacy.map((d) => d.sourceTemplateLabel), [null, null, null]);
});

test("catalogue copy compatibility path carries the origin label to save_program", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/app/admin/programs/actions.ts"), "utf8");
  assert.match(src, /source_template_label: day\.sourceTemplateLabel/);
});

// ---------------------------------------------------------------------------
// The unexecuted 0021 migration
// ---------------------------------------------------------------------------

test("0021 SQL contract: columns, trigger, atomic RPCs, grants and untouched RLS", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/0021_saved_days.sql"), "utf8");
  const body = sql.split("-- Verification")[0];
  assert.match(sql, /Run manually AFTER 0020/);
  assert.match(body, /^begin;$/m); assert.match(body, /^commit;$/m);
  for (const col of ["deleted_at timestamptz", "source_label text", "updated_at timestamptz"]) {
    assert.match(body, new RegExp(`alter table public\\.day_templates add column if not exists ${col}`));
  }
  assert.match(body, /update public\.day_templates set updated_at = created_at where updated_at is null/);
  assert.ok(body.indexOf("set updated_at = created_at") < body.indexOf("alter column updated_at set not null"), "backfill before not null");
  assert.match(body, /alter column updated_at set default now\(\)/);
  assert.match(body, /alter table public\.program_days add column if not exists source_template_label text/);
  assert.match(body, /create trigger day_templates_touch_updated_at before update of title, source_label\s+on public\.day_templates/);
  assert.match(body, /on public\.day_templates \(lower\(title\)\) where deleted_at is null/);
  assert.match(body, /\(deleted_at\) where deleted_at is not null/);
  for (const fn of ["save_program", "copy_catalog_program", "save_day_template", "revert_day_template_save"]) {
    const def = body.slice(body.indexOf(`create or replace function public.${fn}(`));
    const head = def.slice(0, def.indexOf("$$"));
    assert.match(head, /security invoker set search_path = ''/, `${fn} is SECURITY INVOKER with an empty search_path`);
    assert.match(def.slice(0, def.indexOf("end $$")), /raise exception 'staff_access_required' using errcode = '42501'/, `${fn} checks staff`);
  }
  assert.match(body, /create or replace function public\.save_day_template\(\s*p_id uuid, p_title text, p_exercises jsonb, p_source_label text, p_replace_id uuid\s*\) returns uuid/);
  assert.match(body, /create or replace function public\.revert_day_template_save\(p_created_id uuid, p_restore_id uuid\)\s*returns void/);
  assert.match(body, /revoke all on function public\.save_day_template\(uuid, text, jsonb, text, uuid\) from public, anon;/);
  assert.match(body, /grant execute on function public\.save_day_template\(uuid, text, jsonb, text, uuid\) to authenticated;/);
  assert.match(body, /revoke all on function public\.revert_day_template_save\(uuid, uuid\) from public, anon;/);
  assert.match(body, /grant execute on function public\.revert_day_template_save\(uuid, uuid\) to authenticated;/);
  assert.match(body, /insert into public\.program_days\(program_id, title, order_index, source_template_label\)[\s\S]*?nullif\(btrim\(day_row->>'source_template_label'\), ''\)/);
  assert.match(body, /'source_template_label', d\.source_template_label/);
  // The origin label is capped at 200 like saveProgram: column check (re-runnable,
  // legacy values shortened first) and save_program truncates.
  assert.match(body, /left\(nullif\(btrim\(day_row->>'source_template_label'\), ''\), 200\)/);
  const shorten = body.indexOf("update public.program_days set source_template_label = left(source_template_label, 200)");
  const drop = body.indexOf("alter table public.program_days drop constraint if exists program_days_source_template_label_check;");
  const add = body.search(/alter table public\.program_days add constraint program_days_source_template_label_check\s+check \(source_template_label is null or length\(source_template_label\) <= 200\);/);
  assert.ok(shorten > 0 && shorten < drop && drop < add, "shorten, drop if exists, then add the check");
  const actionsSrc = fs.readFileSync(path.join(__dirname, "../src/app/admin/actions.ts"), "utf8");
  assert.match(actionsSrc, /source_template_label: day\.sourceTemplateLabel\?\.trim\(\)\.slice\(0, 200\)/, "the app caps at the same length");
  assert.match(body, /update public\.day_templates set deleted_at = now\(\)\s+where id = p_replace_id and deleted_at is null/);
  assert.match(body, /update public\.day_templates set deleted_at = null\s+where id = p_restore_id and deleted_at is not null/);
  assert.doesNotMatch(sql, /disable row level security/i);
  assert.doesNotMatch(body, /\bto anon\b/i);
  assert.doesNotMatch(body, /security definer/i);
  assert.doesNotMatch(body, /exception\s+when/i, "no handler swallows errors");
  assert.doesNotMatch(body, /drop policy|create policy/i, "RLS policies are untouched");
  // save_program keeps 0018's signature (only the label is added).
  const s18 = fs.readFileSync(path.join(__dirname, "../supabase/migrations/0018_monthly_programs.sql"), "utf8");
  const sig = /create or replace function public\.save_program\(([\s\S]*?)\) returns uuid/;
  assert.equal(body.match(sig)[1].replace(/\s+/g, " "), s18.match(sig)[1].replace(/\s+/g, " "));
  // The verification query is shipped as comments.
  assert.match(sql, /-- select\n--\s+exists\(select 1 from information_schema\.columns/);
  for (const check of ["day_templates_deleted_at", "day_templates_source_label", "day_templates_updated_at", "program_days_source_template_label", "program_days_label_length_check", "touch_trigger", "save_day_template_function", "revert_function"]) {
    assert.match(sql, new RegExp(`as ${check}`));
  }
});
