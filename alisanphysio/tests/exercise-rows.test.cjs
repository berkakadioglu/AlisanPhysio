/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  doseParts,
  doseText,
  appendChip,
  moveItem,
  dropIndex,
  dragTarget,
  restoreRemoved,
  mergeOrder,
  singleLine,
  libraryEntryHref,
  duplicateFlags,
  videoSource,
  foldSearch,
} = require("../src/app/admin/editor/dose.ts");
const { t } = require("../src/lib/i18n.ts");

const LONG = "8 reps each side · 3–5 sec hold";
const V = "dQw4w9WgXcQ";
const W = "SCVCLChPQFY";

test("dose pill: sets emphasised, reps kept intact", () => {
  assert.deepEqual(doseParts(1, "8–12 each side", "en"), { sets: "1", rest: " × 8–12 each side" });
  assert.equal(doseText(doseParts(1, "8–12 each side", "en")), "1 × 8–12 each side");
  const long = doseParts(3, LONG, "en");
  assert.equal(long.sets, "3");
  assert.equal(long.rest, ` × ${LONG}`);
  assert.equal(doseText(long), `3 × ${LONG}`);
  // Surrounding whitespace is trimmed, inner text untouched.
  assert.equal(doseParts(2, `  ${LONG}  `, "tr").rest, ` × ${LONG}`);
});

test("dose pill: sets only uses singular / plural wording, Turkish without plural", () => {
  assert.deepEqual(doseParts(1, null, "en"), { sets: "1", rest: " set" });
  assert.deepEqual(doseParts(3, "", "en"), { sets: "3", rest: " sets" });
  assert.deepEqual(doseParts(1, "   ", "tr"), { sets: "1", rest: " set" });
  assert.deepEqual(doseParts(4, null, "tr"), { sets: "4", rest: " set" });
  assert.equal(doseText(doseParts(3, null, "en")), "3 sets");
});

test("dose pill: reps only, and nothing at all", () => {
  assert.deepEqual(doseParts(null, "8 reps hold for 3 sec each side", "en"), {
    sets: null,
    rest: "8 reps hold for 3 sec each side",
  });
  assert.deepEqual(doseParts(null, null, "en"), { sets: null, rest: "" });
  assert.deepEqual(doseParts(null, "  ", "tr"), { sets: null, rest: "" });
  assert.equal(doseText(doseParts(null, null, "en")), "");
});

test("appendChip: one separating space, never doubled", () => {
  assert.equal(appendChip("3–5", "sec hold"), "3–5 sec hold");
  assert.equal(appendChip("3–5 ", "sec hold"), "3–5 sec hold");
  assert.equal(appendChip("8–12  \t", "each side"), "8–12 each side");
  assert.equal(appendChip("", "AMRAP"), "AMRAP");
  assert.equal(appendChip(null, "each leg"), "each leg");
  assert.equal(appendChip("   ", "to failure"), "to failure");
  assert.equal(appendChip("8 reps", " each side "), "8 reps each side");
  assert.equal(appendChip("8 reps · 3–5", "sec hold"), "8 reps · 3–5 sec hold");
});

test("appendChip: the same chip twice in a row is not repeated", () => {
  assert.equal(appendChip("8 each side", "each side"), "8 each side");
  assert.equal(appendChip("8 Each Side", "each side"), "8 Each Side");
  assert.equal(appendChip("AMRAP", "AMRAP"), "AMRAP");
  // Only a whole-word suffix counts.
  assert.equal(appendChip("8 reps-each side", "each side"), "8 reps-each side each side");
  assert.equal(appendChip("8 each side", "sec hold"), "8 each side sec hold");
});

test("appendChip: Turkish chip text from i18n", () => {
  const sn = t("tr", "ed.chip.secHold");
  assert.equal(appendChip("3–5", sn), `3–5 ${sn}`);
  for (const k of ["eachSide", "eachLeg", "secHold", "toFailure", "amrap"]) {
    const en = t("en", `ed.chip.${k}`);
    const tr = t("tr", `ed.chip.${k}`);
    assert.ok(en && en !== `ed.chip.${k}`, `en ${k}`);
    assert.ok(tr && tr !== `ed.chip.${k}`, `tr ${k}`);
  }
  assert.equal(t("en", "ed.chip.eachSide"), "each side");
  assert.equal(t("tr", "ed.chip.eachSide"), "her iki taraf");
});

test("moveItem moves one item and returns the same array for no-ops", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(moveItem(list, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(list, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(list, 1, 2), ["a", "c", "b", "d"]);
  assert.deepEqual(list, ["a", "b", "c", "d"], "input untouched");
  assert.equal(moveItem(list, 1, 1), list);
  assert.equal(moveItem(list, -1, 2), list);
  assert.equal(moveItem(list, 0, 4), list);
  assert.equal(moveItem([], 0, 0).length, 0);
});

test("dropIndex: a dragged row passes a neighbour at its midpoint", () => {
  // Four rows of 50px at 0, 50, 100, 150 → midpoints 25, 75, 125, 175.
  const mids = [25, 75, 125, 175];
  assert.equal(dropIndex(mids, 0, 25), 0);
  assert.equal(dropIndex(mids, 0, 74), 0);
  assert.equal(dropIndex(mids, 0, 76), 1);
  assert.equal(dropIndex(mids, 0, 400), 3);
  assert.equal(dropIndex(mids, 3, 124), 2);
  assert.equal(dropIndex(mids, 3, -50), 0);
  assert.equal(dropIndex(mids, 2, 125), 2);
});

test("duplicateFlags: same library entry or same name earlier in the day", () => {
  const rows = [
    { name: "Bird dog", library_id: "lib-1" },
    { name: "Dead bug", library_id: null },
    { name: "Bird dog (slow)", library_id: "lib-1" },
    { name: "  dead BUG ", library_id: null },
    { name: "bird dog", library_id: null },
    { name: "", library_id: null },
    { name: "  ", library_id: null },
  ];
  assert.deepEqual(duplicateFlags(rows), [false, false, true, true, true, false, false]);
});

test("videoSource: the override wins, then the library, else nothing", () => {
  assert.equal(videoSource(`https://youtu.be/${W}`, `https://youtu.be/${V}`), "override");
  assert.equal(videoSource(null, `https://www.youtube.com/watch?v=${V}`), "library");
  assert.equal(videoSource("not a link", `https://youtu.be/${V}`), "library");
  assert.equal(videoSource("", null), "none");
  assert.equal(videoSource("https://vimeo.com/123", null), "none");
});

test("foldSearch: case- and accent-insensitive, Turkish letters", () => {
  assert.equal(foldSearch("  Şınav "), "sinav");
  assert.equal(foldSearch("İLİOPSOAS"), "iliopsoas");
  assert.equal(foldSearch("Glute Köprü"), "glute kopru");
  assert.ok(foldSearch("Çapraz Dokunuş").includes(foldSearch("dokunus")));
});

test("every B2 key exists in both languages", () => {
  const src = require("node:fs").readFileSync(require.resolve("../src/lib/i18n.ts"), "utf8");
  const keys = [...new Set(src.match(/"ed\.(?:row|chip|video|add)\.[A-Za-z]+"/g) ?? [])].map((k) => k.slice(1, -1));
  assert.ok(keys.length >= 40);
  for (const k of keys) {
    const occurrences = src.split(`"${k}":`).length - 1;
    assert.equal(occurrences, 2, `${k} should be defined once in en and once in tr`);
  }
});

/** Every slot a pointer drag can reach from `from`, sweeping the raw offset far past both ends. */
function reachable(heights, from) {
  const tops = [];
  let y = 100;
  for (const h of heights) {
    tops.push(y);
    y += h;
  }
  const seen = new Set();
  for (let raw = -(y + 200); raw <= y + 200; raw += 0.5) seen.add(dragTarget(tops, heights, from, raw).to);
  return [...seen].sort((a, b) => a - b);
}

test("dragTarget: every row can be dragged to the very first and last slot", () => {
  const all = (n) => Array.from({ length: n }, (_, i) => i);
  for (const heights of [
    [56, 56, 56, 56, 56],
    [57, 57, 57, 57, 56], // 1px dividers make rows slightly unequal
    [56, 57, 56, 57, 57],
  ]) {
    for (let from = 0; from < heights.length; from++) {
      assert.deepEqual(reachable(heights, from), all(heights.length), `${heights} from ${from}`);
    }
  }
});

test("dragTarget: a tall (expanded) row can move past short neighbours", () => {
  const heights = [56, 701, 56, 56, 56];
  assert.deepEqual(reachable(heights, 1), [0, 1, 2, 3, 4]);
  // It swaps with the next row once its bottom edge passes that row's middle.
  const tops = [0, 56, 757, 813, 869];
  assert.equal(dragTarget(tops, heights, 1, 27).to, 1);
  assert.equal(dragTarget(tops, heights, 1, 29).to, 2);
  assert.equal(dragTarget(tops, heights, 1, -29).to, 0);
});

test("dragTarget: the offset is clamped to the list and no move means no change", () => {
  const tops = [0, 50, 100, 150];
  const heights = [50, 50, 50, 50];
  assert.deepEqual(dragTarget(tops, heights, 1, 0), { dy: 0, to: 1 });
  assert.deepEqual(dragTarget(tops, heights, 1, 999), { dy: 100, to: 3 });
  assert.deepEqual(dragTarget(tops, heights, 1, -999), { dy: -50, to: 0 });
  assert.deepEqual(dragTarget([0], [50], 0, 40), { dy: 0, to: 0 });
});

const r = (key) => ({ key });
const keys = (list) => list.map((e) => e.key).join("");

/**
 * Mirrors ExerciseList: each removal remembers the order (mergeOrder) and its
 * neighbours; each Undo merges the live order in and restores with it.
 */
function simulate(startKeys, removals, undoOrder) {
  let list = startKeys.map(r);
  let memo = [];
  const records = {};
  for (const k of removals) {
    const i = list.findIndex((e) => e.key === k);
    memo = mergeOrder(memo, list.map((e) => e.key));
    records[k] = { index: i, prevKey: list[i - 1]?.key ?? null, nextKey: list[i + 1]?.key ?? null };
    list = list.filter((e) => e.key !== k);
  }
  for (const k of undoOrder) {
    memo = mergeOrder(memo, list.map((e) => e.key));
    list = restoreRemoved(list, r(k), records[k], memo);
  }
  return keys(list);
}

test("restoreRemoved: undoing several removals in any order restores the original order", () => {
  // The reported case: remove B then C, undo B then C (used to give A,C,B,D).
  assert.equal(simulate("ABCD".split(""), ["B", "C"], ["B", "C"]), "ABCD");
  assert.equal(simulate("ABCD".split(""), ["B", "C"], ["C", "B"]), "ABCD");
  assert.equal(simulate("ABCD".split(""), ["C", "B"], ["C", "B"]), "ABCD");
  assert.equal(simulate("ABCD".split(""), ["C", "B"], ["B", "C"]), "ABCD");
  assert.equal(simulate("ABCDE".split(""), ["A", "E", "C"], ["E", "A", "C"]), "ABCDE");
  assert.equal(simulate("ABCDE".split(""), ["B", "C", "D"], ["C", "D", "B"]), "ABCDE");
  assert.equal(simulate("AB".split(""), ["A", "B"], ["A", "B"]), "AB");
});

test("mergeOrder: keeps removed rows, slots in new rows, restarts after a reorder", () => {
  assert.deepEqual(mergeOrder([], ["A", "B"]), ["A", "B"]);
  // B was removed (a ghost); E was added at the end and F at the start.
  assert.deepEqual(mergeOrder(["A", "B", "C", "D"], ["F", "A", "C", "D", "E"]), ["F", "A", "B", "C", "D", "E"]);
  // A reorder of known rows forgets the ghosts.
  assert.deepEqual(mergeOrder(["A", "B", "C", "D"], ["D", "A", "C"]), ["D", "A", "C"]);
  // Without a remembered position, Undo falls back to the neighbours.
  const list = ["D", "A", "C"].map(r);
  assert.equal(keys(restoreRemoved(list, r("B"), { index: 1, prevKey: "A", nextKey: "C" }, ["D", "A", "C"])), "DABC");
});

test("restoreRemoved: falls back to the next neighbour, then the clamped index; never duplicates", () => {
  const list = ["A", "C", "D"].map(r);
  assert.equal(keys(restoreRemoved(list, r("B"), { index: 1, prevKey: "X", nextKey: "C" })), "ABCD");
  assert.equal(keys(restoreRemoved(list, r("B"), { index: 9, prevKey: "X", nextKey: "Y" })), "ACDB");
  assert.equal(keys(restoreRemoved(list, r("B"), { index: 0, prevKey: null, nextKey: null })), "BACD");
  assert.equal(restoreRemoved(list, r("C"), { index: 0, prevKey: null, nextKey: null }), list);
  assert.equal(keys(list), "ACD", "input untouched");
});

test("singleLine: the reps field never keeps line breaks", () => {
  assert.equal(singleLine("8 reps\neach side"), "8 reps each side");
  assert.equal(singleLine("8 reps \r\n\r\n  each side"), "8 reps each side");
  assert.equal(singleLine("8–12 each side "), "8–12 each side ", "typing a trailing space is kept");
  assert.equal(singleLine("8 reps hold for 3 sec each side · 3–5 sec hold"), "8 reps hold for 3 sec each side · 3–5 sec hold");
});

test("libraryEntryHref: links the entry by id and pre-fills the search", () => {
  assert.equal(libraryEntryHref({ id: "abc-123", name: "Bird dog" }), "/admin/library?edit=abc-123&q=Bird+dog");
  const href = libraryEntryHref({ id: "x/y?z", name: "Şınav & köprü" });
  const params = new URL(href, "http://localhost").searchParams;
  assert.equal(params.get("edit"), "x/y?z");
  assert.equal(params.get("q"), "Şınav & köprü");
  assert.equal(libraryEntryHref({ id: "abc", name: "  " }), "/admin/library?edit=abc");
});

test("video override wording exists for both audiences and the external-link state", () => {
  for (const k of [
    "ed.video.override",
    "ed.video.overrideLabel",
    "ed.video.overrideGeneric",
    "ed.video.overrideLabelGeneric",
    "ed.video.external",
    "ed.video.linkOnly",
    "ed.video.externalHint",
  ]) {
    for (const lang of ["en", "tr"]) {
      const v = t(lang, k);
      assert.ok(v && v !== k, `${lang} ${k}`);
    }
  }
  assert.doesNotMatch(t("en", "ed.video.overrideLabelGeneric"), /client/i);
  assert.doesNotMatch(t("tr", "ed.video.overrideLabelGeneric"), /danışan/i);
  assert.match(t("en", "ed.video.overrideLabel"), /client/i);
});
