/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const ops = require("../src/app/admin/editor/day-ops.ts");
const { toDayDraft } = require("../src/app/admin/editor/drafts.ts");

const ex = (name, extra = {}) => ({ name, sets: 3, reps: "8-12", instructions: "Goal: Keep a neutral spine.", media_url: null, library_id: null, ...extra });
const day = (title, exercises = [], sourceTemplateLabel = null) => ({ title, sourceTemplateLabel, sourceTemplateId: null, exercises });
const titles = (days) => days.map((d) => d.title);

test("initialDays starts with one empty day when nothing is loaded", () => {
  const days = ops.initialDays([]);
  assert.equal(days.length, 1);
  assert.deepEqual([days[0].title, days[0].sourceTemplateLabel, days[0].exercises], ["", null, []]);
  assert.equal(ops.initialDays([day("Upper"), day("Lower")]).length, 2);
});

test("asEditorDays keeps only editor fields and defaults the origin label", () => {
  const loaded = [{ title: null, exercises: [{ id: "x", program_id: "p", day_id: "d", order_index: 4, ...ex("Bird dog") }] }];
  assert.deepEqual(ops.asEditorDays(loaded), [day("", [ex("Bird dog")], null)]);
  assert.equal(ops.asEditorDays([{ title: "A", sourceTemplateLabel: "Push Day", exercises: [] }])[0].sourceTemplateLabel, "Push Day");
});

test("dirty snapshot ignores React keys but sees every saved field", () => {
  const source = [day("Upper", [ex("Plank")], "Core Day")];
  const a = { title: "October 2026", monthStartDate: "2026-10-01", notes: "Breathe.", days: ops.initialDays(source) };
  const b = { ...a, days: ops.initialDays(source) };
  assert.notEqual(a.days[0].key, b.days[0].key);
  assert.equal(ops.editorSnapshot(a), ops.editorSnapshot(b));
  assert.notEqual(ops.editorSnapshot(a), ops.editorSnapshot({ ...a, notes: "Breathe!" }));
  assert.notEqual(ops.editorSnapshot(a), ops.editorSnapshot({ ...a, monthStartDate: "2026-11-01" }));
  const edited = ops.patchDay(a.days, a.days[0].key, { exercises: [{ ...a.days[0].exercises[0], sets: 2 }] });
  assert.notEqual(ops.editorSnapshot(a), ops.editorSnapshot({ ...a, days: edited }));
  const relabelled = ops.patchDay(a.days, a.days[0].key, { sourceTemplateLabel: null });
  assert.notEqual(ops.editorSnapshot(a), ops.editorSnapshot({ ...a, days: relabelled }));
});

test("save payload carries the origin label and drops unnamed exercises", () => {
  const days = ops.initialDays([day("Upper", [ex("Plank"), ex("   "), ex("Row", { library_id: "lib-1" })], "Core Day")]);
  days[0].exercises[0].saveToLibrary = true;
  days[0].exercises[2].saveToLibrary = true;
  const [saved] = ops.toSaveDays(days);
  assert.equal(saved.title, "Upper");
  assert.equal(saved.sourceTemplateLabel, "Core Day");
  assert.deepEqual(saved.exercises.map((e) => e.name), ["Plank", "Row"]);
  assert.equal(saved.exercises[0].saveToLibrary, true);
  assert.equal(saved.exercises[1].saveToLibrary, false, "linked rows never save to the library");
  assert.ok(saved.exercises.every((e) => !("key" in e)));
  assert.deepEqual(ops.toSaveExercises(days[0].exercises).map((e) => e.name), ["Plank", "Row"]);
});

test("inserting a saved day lands at the end and Undo removes only that day", () => {
  const days = ops.initialDays([day("Upper", [ex("Plank")]), day("Lower", [ex("Squat")])]);
  const savedDay = day("Push Day", [ex("Push-up"), ex("Dip")], "Push Day");
  const inserted = ops.insertDayAtEnd(days, savedDay);
  assert.deepEqual(titles(inserted.days), ["Upper", "Lower", "Push Day"]);
  assert.equal(inserted.days[2].key, inserted.key);
  assert.equal(inserted.days[2].sourceTemplateLabel, "Push Day");
  assert.equal(inserted.days[0], days[0], "existing days are untouched");
  assert.equal(inserted.days[1], days[1]);
  // A deep copy: editing the inserted day never reaches the saved day.
  inserted.days[2].exercises[0].name = "Changed";
  assert.equal(savedDay.exercises[0].name, "Push-up");
  // Edit another day in between, then undo the insert.
  const edited = ops.patchDay(inserted.days, days[0].key, { title: "Upper body" });
  const undone = ops.removeDay(edited, inserted.key);
  assert.deepEqual(titles(undone.days), ["Upper body", "Lower"]);
  assert.equal(undone.days[1], days[1]);
});

test("duplicate is a deep copy placed right after the original", () => {
  const days = ops.initialDays([day("Upper", [ex("Plank"), ex("Row")], "Core Day"), day("Lower")]);
  const { days: next, key } = ops.duplicateDay(days, days[0].key);
  assert.deepEqual(titles(next), ["Upper", "Upper", "Lower"]);
  const copy = next[1];
  assert.equal(copy.key, key);
  assert.notEqual(copy.key, days[0].key);
  assert.equal(copy.sourceTemplateLabel, "Core Day");
  assert.notEqual(copy.exercises, days[0].exercises);
  copy.exercises.forEach((e, i) => {
    assert.notEqual(e, days[0].exercises[i]);
    assert.notEqual(e.key, days[0].exercises[i].key);
  });
  copy.exercises[0].name = "Side plank";
  assert.equal(days[0].exercises[0].name, "Plank");
  assert.equal(ops.duplicateDay(days, "missing").key, null);
});

test("move day swaps neighbours and is a no-op at the ends", () => {
  const days = ops.initialDays([day("A"), day("B"), day("C")]);
  assert.deepEqual(titles(ops.moveDay(days, days[1].key, -1)), ["B", "A", "C"]);
  assert.deepEqual(titles(ops.moveDay(days, days[1].key, 1)), ["A", "C", "B"]);
  assert.deepEqual(titles(ops.moveDay(days, days[0].key, -1)), ["A", "B", "C"]);
  assert.deepEqual(titles(ops.moveDay(days, days[2].key, 1)), ["A", "B", "C"]);
  assert.deepEqual(titles(days), ["A", "B", "C"], "input is not mutated");
});

test("delete day selects a neighbour and never leaves zero days", () => {
  const days = ops.initialDays([day("A"), day("B"), day("C")]);
  const middle = ops.removeDay(days, days[1].key);
  assert.deepEqual(titles(middle.days), ["A", "C"]);
  assert.equal(middle.selectedKey, days[2].key);
  const last = ops.removeDay(days, days[2].key);
  assert.equal(last.selectedKey, days[1].key);
  const only = ops.initialDays([day("Solo", [ex("Plank")])]);
  const cleared = ops.removeDay(only, only[0].key);
  assert.equal(cleared.days.length, 1);
  assert.deepEqual([cleared.days[0].title, cleared.days[0].exercises], ["", []]);
  assert.equal(cleared.selectedKey, cleared.days[0].key);
});

test("export rows drop unnamed exercises and blank days", () => {
  const days = ops.initialDays([day(" Upper ", [ex("Plank"), ex("")]), day("", [ex(" ")]), day("", [ex("Row")])]);
  assert.deepEqual(ops.toExportDays(days).map((d) => [d.title, d.exercises.map((e) => e.name)]), [["Upper", ["Plank"]], ["", ["Row"]]]);
  assert.equal(ops.hasNamedExercises(days[1]), false);
  assert.equal(ops.hasNamedExercises(days[2]), true);
});

test("saveProgram sends the origin label as p_days[].source_template_label", async () => {
  const Module = require("node:module");
  const rpcs = [];
  const db = { async rpc(name, input) { rpcs.push({ name, input }); return { data: "prog-1", error: null }; } };
  const original = Module._load;
  Module._load = function (request, parent, main) {
    if (request === "@/lib/admin-auth") return { requireStaff: async () => ({ supabase: db }), requireAdmin: async () => ({ supabase: db }) };
    if (request === "@/lib/supabase/admin") return { createAdminClient: () => { throw new Error("service role must not be used"); } };
    if (request === "@/lib/i18n-server") return { getLang: async () => "en" };
    if (request === "next/cache") return { revalidatePath: () => {} };
    return original.call(this, request, parent, main);
  };
  let actions;
  try { actions = require("../src/app/admin/actions.ts"); } finally { Module._load = original; }
  const days = ops.toSaveDays(ops.initialDays([
    day("Push Day", [ex("Push-up"), ex(" ")], "  Push Day  "),
    day("Lower", [ex("Squat")]),
    day("", []),
  ]));
  const res = await actions.saveProgram({ kind: "catalog", clientId: null, title: "Strength", monthStartDate: null, notes: "", days });
  assert.deepEqual(res, { ok: true, programId: "prog-1" });
  const sent = rpcs[0].input.p_days;
  assert.deepEqual(sent.map((d) => [d.title, d.source_template_label, d.exercises.map((e) => e.name)]), [
    ["Push Day", "Push Day", ["Push-up"]],
    ["Lower", null, ["Squat"]],
  ]);
  assert.ok(sent.every((d) => !("sourceTemplateLabel" in d)));
});

test("toDayDraft copies saved days into independent drafts", () => {
  const source = day("Pull", [ex("Row")], "Pull");
  const draft = toDayDraft(source);
  draft.exercises[0].reps = "10";
  assert.equal(source.exercises[0].reps, "8-12");
});

// ---- review fixes (stream F2) ----

test("a row whose name was cleared blocks the save instead of vanishing (#9)", () => {
  const days = ops.initialDays([day("Upper", [ex("Plank")]), day("Lower", [ex("Squat"), ex("  ", { instructions: "Cues the coach typed" })])]);
  assert.deepEqual(ops.firstUnnamedExercise(days), { dayIndex: 1, exerciseIndex: 1 });
  // The save payload would silently drop it — which is why the editor blocks.
  assert.deepEqual(ops.toSaveDays(days)[1].exercises.map((e) => e.name), ["Squat"]);
  assert.equal(ops.firstUnnamedExercise(ops.initialDays([day("A", [ex("Plank")]), day("B", [])])), null);
  assert.deepEqual(ops.firstUnnamedExercise(ops.initialDays([day("Saved", [ex(""), ex("")])])), { dayIndex: 0, exerciseIndex: 0 });
});

test("titles stay one logical line (#1)", () => {
  assert.equal(ops.singleLine("Upper Body –\nNeck & Shoulder\r\nControl\rDay"), "Upper Body – Neck & Shoulder Control Day");
  assert.equal(ops.singleLine("Lower Body"), "Lower Body");
});

test("?day=N picks the day the first save came from (#10)", () => {
  assert.equal(ops.dayIndexFromParam(undefined), 0);
  assert.equal(ops.dayIndexFromParam("3"), 2);
  assert.equal(ops.dayIndexFromParam(["2", "5"]), 1);
  assert.equal(ops.dayIndexFromParam("1"), 0);
  for (const bad of ["0", "-1", "abc", "2.5", "", "99999"]) assert.equal(ops.dayIndexFromParam(bad), 0, bad);
});

const guardLib = require("../src/app/admin/editor/leave-guard.ts");
const EDIT_URL = "https://app.test/admin/clients/c1/programs/p1/edit";

function fakeEnv({ state = null, href = EDIT_URL, answers = [], canGoBack = true } = {}) {
  const env = {
    log: [],
    replaced: [],
    timers: [],
    confirms: 0,
    history: {
      state,
      scrollRestoration: "auto",
      pushState(data) { env.log.push("push"); this.state = data; },
      replaceState(data) { env.replaced.push(data); this.state = data; },
      back() { env.log.push("back"); },
    },
    location: { href },
    canGoBack: () => canGoBack,
    confirm() { env.confirms++; return answers.length ? answers.shift() : false; },
    setTimeout(fn, ms) { env.timers.push({ fn, ms, cleared: false }); return env.timers.length - 1; },
    clearTimeout(id) { if (env.timers[id]) env.timers[id].cleared = true; },
  };
  return env;
}
function makeGuard(env, dirty = { value: true }) {
  return guardLib.createLeaveGuard(env, { isDirty: () => dirty.value, message: () => "Leave without saving?" });
}
const link = (href, extra = {}) => ({ href, target: "", download: false, ...extra });

test("leave guard: links to other pages ask while dirty (#11)", () => {
  const dirty = { value: false };
  const env = fakeEnv({ answers: [false, true] });
  const guard = makeGuard(env, dirty);
  assert.equal(guard.onLinkClick(link("https://app.test/admin")), true, "clean: no prompt");
  assert.equal(env.confirms, 0);
  dirty.value = true;
  assert.equal(guard.onLinkClick(link("https://app.test/admin/programs")), false, "declined: blocked");
  assert.equal(guard.onLinkClick(link(`${EDIT_URL}#notes`)), true, "same page #hash");
  assert.equal(guard.onLinkClick(link("https://app.test/admin/library", { target: "_blank" })), true, "new tab");
  assert.equal(guard.onLinkClick(link("https://app.test/admin/export", { download: true })), true, "download");
  assert.equal(guard.onLinkClick(link("https://youtube.com/watch?v=x")), true, "cross-origin → beforeunload");
  assert.equal(guard.onLinkClick(link("mailto:coach@example.test")), true);
  assert.equal(env.confirms, 1);
  assert.equal(guard.shouldWarnOnUnload(), true);
  assert.equal(guard.onLinkClick(link("https://app.test/admin")), true, "confirmed: allowed");
  assert.equal(guard.shouldWarnOnUnload(), false, "no second (beforeunload) prompt after agreeing");
  assert.equal(guardLib.leavesPage(link("/admin/library"), EDIT_URL), true, "relative href");
  assert.equal(guardLib.leavesPage(link(`${EDIT_URL}?day=2`), EDIT_URL), true, "other query");
  assert.equal(guardLib.isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }), true);
  assert.equal(guardLib.isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, defaultPrevented: false }), false);
  assert.equal(guardLib.isPlainLeftClick({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }), false);
});

test("leave guard: browser Back pops a sentinel and asks (#11)", () => {
  const env = fakeEnv({ answers: [false, true] });
  const guard = makeGuard(env);
  guard.arm();
  guard.arm();
  assert.deepEqual(env.log, ["push"], "one sentinel per dirty stretch");
  assert.equal(env.history.scrollRestoration, "manual", "popping the sentinel must not jump the page");
  // Back: the sentinel is popped → same URL, state without our key.
  guard.onPopState({ __NA: true });
  assert.equal(env.confirms, 1);
  assert.deepEqual(env.log, ["push", "push"], "Stay → sentinel re-pushed, still on the editor");
  guard.onPopState({ __NA: true });
  assert.equal(env.confirms, 2);
  assert.deepEqual(env.log, ["push", "push", "back"], "Leave → one more step back");
  assert.equal(env.history.scrollRestoration, "auto");
  assert.equal(guard.shouldWarnOnUnload(), false);
});

test("leave guard: a clean editor passes Back straight through", () => {
  const dirty = { value: true };
  const env = fakeEnv();
  const guard = makeGuard(env, dirty);
  guard.arm();
  dirty.value = false; // e.g. saved
  guard.onPopState({ __NA: true });
  assert.equal(env.confirms, 0);
  assert.deepEqual(env.log, ["push", "back"]);
  // Unrelated history moves (no sentinel armed) are left to Next.
  guard.onPopState({ __NA: true });
  assert.deepEqual(env.log, ["push", "back"]);
});

test("leave guard: release() pops the sentinel without a prompt before the editor navigates", async () => {
  const env = fakeEnv();
  const guard = makeGuard(env);
  await guard.release(); // nothing armed → immediate, no history change
  assert.deepEqual(env.log, []);
  guard.arm();
  const released = guard.release();
  assert.equal(guard.release(), released, "concurrent releases share one back()");
  assert.deepEqual(env.log, ["push", "back"]);
  guard.onPopState({ __NA: true });
  await released;
  assert.equal(env.confirms, 0, "no prompt for our own navigation");
  assert.deepEqual(env.log, ["push", "back"], "no extra back");
  assert.equal(env.history.scrollRestoration, "auto");
  guard.arm(); // still dirty (edited during the save) → armed again
  assert.deepEqual(env.log, ["push", "back", "push"]);
});

test("leave guard: a #hash entry or a sentinel found on mount is handled", () => {
  const env = fakeEnv({ state: { __NA: true, [guardLib.LEAVE_GUARD_STATE_KEY]: true } });
  const dirty = { value: false };
  const guard = makeGuard(env, dirty);
  // Back from a page we left via a link lands on our old sentinel: adopted, so
  // one more Back passes through to where the coach came from.
  guard.onPopState({ __NA: true });
  assert.deepEqual(env.log, ["back"]);
  const env2 = fakeEnv();
  const guard2 = makeGuard(env2);
  guard2.arm();
  env2.location.href = `${EDIT_URL}#top`;
  guard2.onPopState(null); // a fragment navigation, not the user leaving
  assert.equal(env2.confirms, 0);
  assert.deepEqual(env2.log, ["push"]);
  env2.location.href = EDIT_URL;
  guard2.onPopState({ __NA: true, [guardLib.LEAVE_GUARD_STATE_KEY]: true }); // Back onto the sentinel
  guard2.onPopState({ __NA: true }); // Back again → asks
  assert.equal(env2.confirms, 1);
});

// ---- review round 2: history robustness (#3 #5 #8), save day index (#7), title caret (#9) ----

const KEY = guardLib.LEAVE_GUARD_STATE_KEY;
const ORIGIN = "https://app.test";

/**
 * A tiny browser: a session history (entries + index), async traversals
 * (`flush()` delivers the queued popstates) and the bits of Next's app router
 * that matter: `nextReplace` rewrites the current entry WITHOUT custom keys
 * (router.refresh() / router.replace / revalidating actions), `nextPush` adds
 * an entry (a link). Guards mount / unmount like editors do.
 */
function browser(paths) {
  const b = {
    entries: paths.map((path) => ({ url: ORIGIN + path, state: { __NA: true } })),
    index: paths.length - 1,
    queue: [],
    guards: new Set(),
    confirmAnswers: [],
    get url() { return b.entries[b.index].url; },
    get path() { return b.url.slice(ORIGIN.length); },
    history: {
      scrollRestoration: "auto",
      get state() { return b.entries[b.index].state; },
      get length() { return b.entries.length; },
      pushState(data) {
        b.entries.splice(b.index + 1);
        b.entries.push({ url: b.url, state: { __NA: true, ...data } });
        b.index++;
      },
      replaceState(data) { b.entries[b.index].state = { __NA: true, ...data }; },
      back() { b.queue.push(-1); },
    },
    location: { get href() { return b.url; } },
    nextReplace(path) {
      b.entries[b.index] = { url: path ? ORIGIN + path : b.url, state: { __NA: true } };
    },
    nextPush(path) {
      b.entries.splice(b.index + 1);
      b.entries.push({ url: ORIGIN + path, state: { __NA: true } });
      b.index++;
    },
    /** A user Back / Forward press (async like the real one). */
    go(delta) { b.queue.push(delta); b.flush(); },
    flush() {
      while (b.queue.length) {
        const delta = b.queue.shift();
        const target = b.index + delta;
        if (target < 0 || target >= b.entries.length) continue;
        b.index = target;
        const state = b.history.state;
        for (const g of [...b.guards]) g.onPopState(state);
      }
    },
    mount(dirty = { value: false }) {
      const env = {
        history: b.history,
        location: b.location,
        canGoBack: () => b.index > 0,
        confirm: () => (b.confirmAnswers.length ? b.confirmAnswers.shift() : true),
        setTimeout: () => 0,
        clearTimeout: () => {},
      };
      const guard = guardLib.createLeaveGuard(env, { isDirty: () => dirty.value, message: () => "Leave?" });
      b.guards.add(guard);
      guard.unmount = () => { guard.dispose(); b.guards.delete(guard); };
      return guard;
    },
  };
  return b;
}

test("leave guard: a refresh while armed no longer costs an extra Back after leaving and coming back (#3)", () => {
  const b = browser(["/prev", "/admin/programs/p1/edit"]);
  const dirty = { value: true };
  const editor = b.mount(dirty);
  editor.arm();
  assert.equal(b.history.state[KEY], true);
  b.nextReplace(); // "Save day as template" → router.refresh(): Next drops our key
  assert.equal(b.history.state[KEY], undefined);
  editor.restamp(); // the editor's per-render effect
  assert.equal(b.history.state[KEY], true, "marker back");
  assert.equal(b.history.state.__NA, true, "Next's own keys kept");
  b.nextReplace(); // wiped again, then the coach clicks a header link
  assert.equal(editor.onLinkClick(link(`${ORIGIN}/admin/clients`)), true);
  assert.equal(b.history.state[KEY], true, "re-stamped before leaving");
  editor.unmount();
  b.nextPush("/admin/clients");
  // Back → the editor remounts on the sentinel and adopts it.
  b.go(-1);
  assert.equal(b.path, "/admin/programs/p1/edit");
  b.mount();
  // ONE more Back reaches where the coach came from (clean editor → no prompt).
  b.go(-1);
  assert.equal(b.path, "/prev");
});

test("leave guard: restamp never touches a released or unarmed entry (#3)", async () => {
  const b = browser(["/prev", "/edit"]);
  const editor = b.mount({ value: true });
  editor.restamp();
  assert.equal(b.history.state[KEY], undefined, "not armed → nothing to stamp");
  editor.arm();
  const released = editor.release();
  editor.restamp(); // a render while the release is in flight
  assert.equal(b.history.state[KEY], "spent");
  b.flush();
  await released;
  editor.restamp();
  assert.equal(b.history.state[KEY], undefined, "the editor's own entry is never stamped");
});

test("leave guard: after the first save, Forward cannot reopen the blank new-programme editor (#5)", async () => {
  const b = browser(["/prev", "/admin/programs/new"]);
  const dirty = { value: true };
  const editor = b.mount(dirty);
  editor.arm();
  b.nextReplace(); // a refresh wiped the marker before the save: still marked spent
  dirty.value = false;
  const released = editor.release();
  b.flush();
  await released;
  b.nextReplace("/admin/programs/p1/edit?day=1"); // router.replace onto the editor's own entry
  editor.unmount();
  const edit = b.mount();
  assert.deepEqual(b.entries.map((e) => e.url.slice(ORIGIN.length)), ["/prev", "/admin/programs/p1/edit?day=1", "/admin/programs/new"]);
  assert.equal(b.entries[2].state[KEY], "spent");
  // Forward lands on the spent entry → stepped straight back.
  b.go(1);
  assert.equal(b.path, "/admin/programs/p1/edit?day=1");
  // A guard that mounts ON a spent entry (e.g. via the history menu) does not adopt it.
  edit.unmount();
  b.index = 2;
  const stray = b.mount({ value: true });
  stray.arm();
  assert.equal(b.entries.length, 4, "not adopted: a fresh sentinel is pushed");
  stray.unmount();
  // Back from the saved programme goes to where the coach came from.
  b.index = 1;
  b.entries.splice(2);
  b.mount();
  b.go(-1);
  assert.equal(b.path, "/prev");
});

test("leave guard: a normal save's popped sentinel is skipped by Forward too (#5)", async () => {
  const b = browser(["/prev", "/edit"]);
  const dirty = { value: true };
  const editor = b.mount(dirty);
  editor.arm();
  dirty.value = false;
  const released = editor.release();
  b.flush();
  await released;
  b.nextReplace(); // router.refresh()
  b.go(1);
  assert.equal(b.index, 1, "back on the editor's own entry");
  b.go(-1);
  assert.equal(b.path, "/prev", "a single Back leaves");
});

test("leave guard: an editor that is the tab's first entry never arms Back (#8)", () => {
  const b = browser(["/admin/programs/p1/edit"]);
  const dirty = { value: true };
  const editor = b.mount(dirty);
  editor.arm();
  assert.equal(b.entries.length, 1, "no sentinel → Back stays disabled");
  assert.equal(editor.shouldWarnOnUnload(), true, "closing the tab still asks");
  assert.equal(editor.onLinkClick(link(`${ORIGIN}/admin`)), true, "links still ask (answered OK here)");
  const env = fakeEnv({ canGoBack: false });
  const guard = makeGuard(env);
  guard.arm();
  assert.deepEqual(env.log, []);
});

test("leave guard: Stay keeps the editor and Leave takes one more Back", () => {
  const b = browser(["/prev", "/edit"]);
  const dirty = { value: true };
  b.mount(dirty).arm();
  b.confirmAnswers.push(false);
  b.go(-1);
  assert.equal(b.path, "/edit");
  assert.equal(b.entries.length, 3, "Stay → sentinel back");
  b.confirmAnswers.push(true);
  b.go(-1);
  assert.equal(b.path, "/prev");
});

test("?day=N counts only the days the save keeps (#7)", () => {
  const days = ops.initialDays([day("Upper", [ex("Plank")]), day("", []), day("", [ex("Squat")]), day("   ", [ex(" ")])]);
  assert.equal(ops.savedDayIndex(days, 0), 0);
  assert.equal(ops.savedDayIndex(days, 2), 1, "the blank Day 2 is dropped");
  assert.equal(ops.savedDayIndex(days, 1), 0, "a blank selected day → the kept day before it");
  assert.equal(ops.savedDayIndex(days, 3), 1);
  assert.equal(ops.savedDayIndex(ops.initialDays([day("", []), day("Lower", [])]), 0), 0);
  assert.equal(ops.daySurvivesSave(days[1]), false);
  assert.equal(ops.daySurvivesSave(days[2]), true);
  // Same rule as saveProgram's filter.
  assert.equal(ops.toSaveDays(days).filter((d) => d.title.trim() || d.exercises.length).length, 2);
});

test("title normalising keeps the caret where it was (#9)", () => {
  const raw = "Neck\r\nCare day";
  assert.equal(ops.singleLine(raw), "Neck Care day");
  assert.equal(ops.singleLineCaret(raw, 6), 5, "after the pasted line break");
  assert.equal(ops.singleLineCaret("Up\nper", 3), 3);
  assert.equal(ops.singleLineCaret("abc", 99), 3);
  assert.equal(ops.singleLineCaret("abc", 0), 0);
});
