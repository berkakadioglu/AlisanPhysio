/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The catalogs are module-private, so read them from the source: every key of a
// dictionary literal sits at the start of its own line ("key": "value" or
// "key":\n "value").
const source = fs.readFileSync(path.join(__dirname, "../src/lib/i18n.ts"), "utf8").replace(/\r\n/g, "\n");
function entries(name) {
  const start = source.indexOf(`const ${name}: Dict = {`);
  const end = source.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start, `dictionary ${name} found`);
  const body = source.slice(start, end);
  const list = [...body.matchAll(/^\s*"([^"]+)"\s*:\s*\n?\s*("(?:[^"\\]|\\.)*")/gm)].map((m) => [m[1], JSON.parse(m[2])]);
  // Guard the parser itself: every key line must have been read with its value.
  assert.equal(list.length, [...body.matchAll(/^\s*"([^"]+)"\s*:/gm)].length, `all ${name} entries parsed`);
  return list;
}
const en = entries("en");
const tr = entries("tr");

test("every i18n key exists in both English and Turkish", () => {
  const enKeys = new Set(en.map(([k]) => k));
  const trKeys = new Set(tr.map(([k]) => k));
  assert.deepEqual([...enKeys].filter((k) => !trKeys.has(k)), [], "keys missing in tr");
  assert.deepEqual([...trKeys].filter((k) => !enKeys.has(k)), [], "keys missing in en");
});

test("no key is defined twice in a dictionary (a later duplicate silently wins)", () => {
  for (const [name, list] of [["en", en], ["tr", tr]]) {
    const seen = new Set();
    const dupes = list.map(([k]) => k).filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    assert.deepEqual(dupes, [], `duplicate keys in ${name}`);
  }
});

test("both languages use the same {placeholders} for every key", () => {
  const trMap = new Map(tr);
  const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const mismatched = en.filter(([k, v]) => trMap.has(k) && params(v) !== params(trMap.get(k))).map(([k]) => k);
  assert.deepEqual(mismatched, []);
});
