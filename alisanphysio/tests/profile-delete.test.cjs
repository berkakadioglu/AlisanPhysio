/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { t } = require("../src/lib/i18n.ts");

const USER = "11111111-1111-4111-8111-111111111111";

/** The profile actions with a scripted Supabase delete (mocked modules, no network). */
function loadActions(script) {
  const calls = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
    from(table) {
      const call = { table, filters: [], deleted: false, selected: null };
      calls.push(call);
      const query = {
        delete() { call.deleted = true; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        select(columns) { call.selected = columns; return Promise.resolve(script(call)); },
      };
      return query;
    },
  };
  const original = Module._load;
  Module._load = function (request, parent, main) {
    if (request === "@/lib/supabase/server") return { createClient: async () => db };
    if (request === "@/lib/i18n-server") return { getLang: async () => "tr" };
    if (request === "next/cache") return { revalidatePath: () => {} };
    if (request === "next/navigation") return { redirect: () => { throw new Error("redirect"); } };
    return original.call(this, request, parent, main);
  };
  const file = require.resolve("../src/app/dashboard/profile/actions.ts");
  delete require.cache[file];
  try {
    return { actions: require(file), calls };
  } finally {
    Module._load = original;
  }
}

test("profile deletes are scoped to the signed-in user and report every failure (Part 5)", async () => {
  for (const [action, table, key] of [["deleteMeasurement", "measurements", "err.measurementDelete"], ["deleteComplaint", "complaints", "err.noteDelete"]]) {
    // Success: exactly one own row removed.
    let loaded = loadActions(() => ({ data: [{ id: "row" }], error: null }));
    assert.deepEqual(await loaded.actions[action]({ id: "row" }), { ok: true });
    assert.equal(loaded.calls[0].table, table);
    assert.ok(loaded.calls[0].deleted);
    assert.deepEqual(loaded.calls[0].filters, [["id", "row"], ["client_id", USER]]);

    // Nothing deleted (already gone / not theirs): an error, never a fake success.
    loaded = loadActions(() => ({ data: [], error: null }));
    assert.deepEqual(await loaded.actions[action]({ id: "row" }), { ok: false, error: t("tr", key) });

    // Database error: a localised message, not the raw database text.
    const quiet = console.error;
    console.error = () => {};
    try {
      loaded = loadActions(() => ({ data: null, error: { message: "permission denied for table" } }));
      assert.deepEqual(await loaded.actions[action]({ id: "row" }), { ok: false, error: t("tr", key) });
    } finally {
      console.error = quiet;
    }
  }
});

test("the profile view shows an error toast for failed and thrown deletes", () => {
  const view = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/profile/profile-view.tsx"), "utf8");
  for (const [action, key] of [["deleteMeasurement", "err.measurementDelete"], ["deleteComplaint", "err.noteDelete"]]) {
    const start = view.indexOf(`await ${action}(`);
    assert.ok(start > 0, `${action} is called`);
    const handler = view.slice(view.lastIndexOf("async function remove", start), view.indexOf("finally", start));
    assert.match(handler, /else \{\s*toast\.error\(res\.error\);/, `${action}: a failed result shows its error`);
    assert.match(handler, new RegExp(`catch \\{[\\s\\S]*toast\\.error\\(t\\("${key.replace(".", "\\.")}"\\)\\)`), `${action}: a thrown call shows a toast`);
  }
});
