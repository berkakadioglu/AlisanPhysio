/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  parseInline,
  parseLines,
  serializeLines,
  serializeInline,
  parseRichText,
  normalizeLineBreaks,
  inlineToPlain,
  richTextExcerpt,
  richTextToPlain,
  isRichTextEmpty,
} = require("../src/lib/rich-text.ts");
const {
  domToLines,
  linesToDom,
  htmlToLines,
  plainTextToLines,
  serializeLinesPreserving,
  canonicalInline,
  splitLabelPrefix,
  plainTextPaste,
} = require("../src/lib/rich-text-dom.ts");
const RichTextModule = require("../src/components/rich-text.tsx");
const RichText = RichTextModule.default;
const { RichTextExcerpt } = RichTextModule;

// ---------------------------------------------------------------------------
// A tiny fake DOM (just what rich-text-dom reads and writes) + an HTML parser
// good enough for clipboard snippets from Chrome, Google Docs and Word.
// ---------------------------------------------------------------------------

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.nodeName = "#text";
    this.nodeValue = text;
    this.childNodes = [];
  }
}
class FakeComment {
  constructor(text) {
    this.nodeType = 8;
    this.nodeName = "#comment";
    this.nodeValue = text;
    this.childNodes = [];
  }
}
class FakeElement {
  constructor(tag) {
    this.nodeType = 1;
    this.nodeName = tag.toUpperCase();
    this.nodeValue = null;
    this.childNodes = [];
    this.attrs = new Map();
  }
  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }
}
const fakeDoc = {
  createElement: (tag) => new FakeElement(tag),
  createTextNode: (text) => new FakeText(text),
};

function el(tag, attrs, ...children) {
  const node = new FakeElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) node.setAttribute(k, v);
  for (const child of children) node.appendChild(typeof child === "string" ? new FakeText(child) : child);
  return node;
}

const VOID = new Set(["BR", "IMG", "META", "LINK", "HR", "INPUT", "SOURCE", "WBR"]);
const ENTITIES = { nbsp: "\u00a0", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, name) => {
    if (name[0] === "#") return String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? m;
  });

/** Parses an HTML snippet into a fake <body>. */
function parseHtml(html) {
  const body = new FakeElement("body");
  const stack = [body];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      const stop = end < 0 ? html.length : end;
      top().appendChild(new FakeComment(html.slice(i + 4, stop)));
      i = stop + 3;
    } else if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const end = html.indexOf(">", i);
      top().appendChild(new FakeComment(html.slice(i + 2, end)));
      i = end + 1;
    } else if (html.startsWith("</", i)) {
      const end = html.indexOf(">", i);
      const name = html.slice(i + 2, end).trim().toUpperCase();
      const at = stack.map((n) => n.nodeName).lastIndexOf(name);
      if (at > 0) stack.length = at;
      i = end + 1;
    } else if (html[i] === "<" && /[a-z]/i.test(html[i + 1] ?? "")) {
      const m = /^<([a-z][\w:-]*)/i.exec(html.slice(i));
      const node = new FakeElement(m[1]);
      let j = i + m[0].length;
      const attrRe = /\s*([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;
      for (;;) {
        attrRe.lastIndex = j;
        const a = attrRe.exec(html);
        if (!a || a[0].trim() === "") break;
        node.setAttribute(a[1].toLowerCase(), decode(a[2] ?? a[3] ?? a[4] ?? ""));
        j = attrRe.lastIndex;
      }
      const end = html.indexOf(">", j);
      const selfClosing = html[end - 1] === "/";
      top().appendChild(node);
      if (["HTML", "HEAD", "BODY"].includes(node.nodeName)) {
        // Flatten document wrappers into our body (like a parser would).
        top().childNodes.pop();
        if (node.nodeName === "HEAD") stack.push(node);
      } else if (!VOID.has(node.nodeName) && !selfClosing) stack.push(node);
      i = end + 1;
    } else {
      const next = html.indexOf("<", i + 1);
      const stop = next < 0 ? html.length : next;
      top().appendChild(new FakeText(decode(html.slice(i, stop))));
      i = stop;
    }
  }
  return body;
}
const fakeParser = { parseFromString: (html) => ({ body: parseHtml(html) }) };

/** A div root holding the given nodes (the editor's contentEditable). */
function editorRoot(nodes) {
  return el("div", { contenteditable: "true" }, ...nodes);
}
const readEditor = (root) => serializeLines(domToLines(root, { collapseWhitespace: false }));
/** What the editor emits for md: DOM built from it, read back, unchanged lines keep their spelling. */
const domRoundTrip = (md) =>
  serializeLinesPreserving(domToLines(editorRoot(linesToDom(parseLines(md), fakeDoc))), md);
/** The strict variant: canonical serialisation only. */
const domRoundTripCanonical = (md) => readEditor(editorRoot(linesToDom(parseLines(md), fakeDoc)));
const pasteHtml = (html) => serializeLines(htmlToLines(html, fakeParser));
const html = (node) => renderToStaticMarkup(React.createElement(RichText, node));

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test("inline parsing: bold, italic, strike, nesting, intraword and stray asterisks", () => {
  assert.deepEqual(parseInline("**bold** and *it* and ~~gone~~"), [
    { type: "bold", children: [{ type: "text", text: "bold" }] },
    { type: "text", text: " and " },
    { type: "italic", children: [{ type: "text", text: "it" }] },
    { type: "text", text: " and " },
    { type: "strike", children: [{ type: "text", text: "gone" }] },
  ]);
  assert.deepEqual(parseInline("**a *b* c**"), [
    { type: "bold", children: [{ type: "text", text: "a " }, { type: "italic", children: [{ type: "text", text: "b" }] }, { type: "text", text: " c" }] },
  ]);
  const both = parseInline("***both***");
  assert.equal(inlineToPlain(both), "both");
  assert.equal(both.length, 1);
  assert.notEqual(both[0].type, "text");
  assert.equal(both[0].children[0].type === "text" ? "flat" : "nested", "nested");
  assert.deepEqual(parseInline("foo**bar**baz"), [
    { type: "text", text: "foo" },
    { type: "bold", children: [{ type: "text", text: "bar" }] },
    { type: "text", text: "baz" },
  ]);
  assert.deepEqual(parseInline("3 * 5 = 15"), [{ type: "text", text: "3 * 5 = 15" }]);
  assert.deepEqual(parseInline("~5 min, ~~~"), [{ type: "text", text: "~5 min, ~~~" }]);
  assert.deepEqual(parseInline("**unclosed"), [{ type: "text", text: "**unclosed" }]);
});

test("legacy bullets (* and •) keep their marker; labels are detected as typed", () => {
  const lines = parseLines("* one\n• two\n- three");
  assert.deepEqual(lines.map((l) => [l.kind, l.marker]), [["item", "*"], ["item", "•"], ["item", "-"]]);
  const blocks = parseRichText("Goal: Improve cervical strength.\n\nCues:\n\n* Keep neutral.\n- Use a towel");
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], { type: "paragraph", lines: [{ label: "Goal", inline: [{ type: "text", text: "Improve cervical strength." }] }] });
  assert.deepEqual(blocks[1], { type: "paragraph", lines: [{ label: "Cues", inline: [] }] });
  assert.equal(blocks[2].type, "list");
  assert.equal(blocks[2].items.length, 2);
  for (const [src, label] of [["NOTE: x", "NOTE"], ["note: x", "note"], ["Hedef: güç", "Hedef"], ["Not: yavaş", "Not"], ["İpucu: nefes", "İpucu"]]) {
    assert.equal(parseRichText(src)[0].lines[0].label, label, src);
  }
  // Only at the start of a line, and only for known words.
  assert.equal(parseRichText("My goal: x")[0].lines[0].label, null);
  assert.equal(parseRichText("Tempo: 3-1-1")[0].lines[0].label, null);
  // Labels are not detected on bullet items.
  assert.equal(parseRichText("- Goal: x")[0].items[0].label, null);
});

test("Windows, old Mac and phone line breaks are normalised", () => {
  assert.equal(normalizeLineBreaks("a\r\nb\rc\u2028d"), "a\nb\nc\nd");
  assert.deepEqual(parseLines("a\r\n\r\n- b").map((l) => l.kind), ["text", "blank", "item"]);
  assert.equal(richTextToPlain("Goal: x\r\n\r\n* a\r\n* b"), "Goal: x\n\n• a\n• b");
});

test("backslash escapes and React escaping: no HTML ever reaches the page", () => {
  assert.deepEqual(parseInline("\\*not italic\\*"), [{ type: "text", text: "*not italic*" }]);
  assert.equal(parseLines("\\- not a list")[0].kind, "text");
  assert.equal(serializeLines([{ kind: "text", inline: [{ type: "text", text: "- not a list" }] }]), "\\- not a list");
  const out = html({ value: "<script>alert(1)</script> **x** <img src=x onerror=alert(1)>" });
  assert.match(out, /&lt;script&gt;/);
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /<img/i);
  assert.match(out, /<strong class="font-semibold">x<\/strong>/);
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

test("RichText renders paragraphs, line breaks, lists and brand labels", () => {
  const out = html({ value: "Goal: Improve strength.\nSlowly.\n\nCues:\n* Keep *neck* neutral\n* ~~Old cue~~" });
  assert.match(out, /^<div class="[^"]*text-sm leading-relaxed[^"]*">/);
  assert.match(out, /<p><strong class="font-semibold text-brand">Goal<\/strong> Improve strength\.<br\/>Slowly\.<\/p>/);
  assert.match(out, /<p><strong class="font-semibold text-brand">Cues<\/strong><\/p>/);
  assert.match(out, /<ul class="list-disc[^"]*marker:text-brand[^"]*"><li[^>]*>Keep <em>neck<\/em> neutral<\/li><li[^>]*><s>Old cue<\/s><\/li><\/ul>/);
  assert.match(html({ value: "x", size: "base", className: "text-muted-foreground" }), /text-base[^"]*text-muted-foreground/);
  assert.equal(html({ value: "" }), "");
  assert.equal(html({ value: "  \n\n " }), "");
  assert.equal(html({ value: null }), "");
});

test("excerpts are one plain line without Markdown markers", () => {
  const src = "Goal: Improve **cervical** strength.\n\nCues:\n\n* Keep your head *neutral*.\n- Use a towel";
  assert.equal(richTextExcerpt(src), "Goal: Improve cervical strength. Cues: • Keep your head neutral. • Use a towel");
  assert.equal(richTextExcerpt(src, 20), "Goal: Improve cervi…");
  assert.equal(richTextExcerpt("~~"), "~~");
  assert.equal(isRichTextEmpty("\n \n"), true);
  const span = renderToStaticMarkup(React.createElement(RichTextExcerpt, { value: "**Hi** <b>", className: "truncate" }));
  assert.equal(span, '<span class="truncate">Hi &lt;b&gt;</span>');
  assert.equal(renderToStaticMarkup(React.createElement(RichTextExcerpt, { value: "" })), "");
});

// ---------------------------------------------------------------------------
// Round trips
// ---------------------------------------------------------------------------

const CORPUS = [
  "",
  "plain",
  "**bold** and *italic* and ~~strike~~",
  "**a *b* c**",
  "*a **b** c*",
  "***both***",
  "foo**bar**baz",
  "3 * 5 = 15",
  "~5 min ~~~ ~",
  "\\*literal\\* and \\~\\~not strike\\~\\~",
  "C:\\Users\\path and a \\ alone",
  "\\- not a list\n\\• not either",
  "- one\n- two\n\n* three\n• four",
  "- \n- **bold item**\n- ",
  "-\n•\n\\*",
  "a\n\n\nb\n",
  "\nleading blank",
  "trailing spaces   \n   leading spaces\n\t tab",
  "   ",
  "Goal: Improve cervical strength and stability.\n\nCues:\n\n* Keep your head and neck neutral.\n* Gently rotate…\n- You can use towel or yoga block\n\n1 Set × 8 Reps Each Side — 3–5 sec hold",
  "Goal:**Bold right after**\nGOAL :  spaced\n  Note: indented label\nCues:",
  "Hedef: Boyun gücünü artırmak.\nİpucu: Nefesini tut**ma**.\nNot: Ağrı olursa dur.",
  "Hello 👋 — emojis, “quotes” and İğüşöç",
  "\\*\\*unclosed bold",
  "a**b**c*d*e~~f~~g",
  "**bold**~~strike~~*it*",
  // Indented "*" text lines stay text (escaped), not bullets.
  "  \\* a",
  " \\* indented star text",
  "\t\\*\ttab",
];

/** Legacy spellings the canonical serialiser would escape ("2\\*3"). */
const LEGACY_SPELLINGS = [
  "3*10 reps and 2*3",
  "**unclosed bold\n*unclosed italic\n~~unclosed strike",
  "\\*literal\\* and \\~~not strike\\~~",
  "-\n*\n•\n**",
  "  - indented bullet\n-   extra spaces",
  // An NBSP after a marker (or as indentation) is not a bullet: text lines
  // that must come back byte-identical, not respelled "\\- Keep".
  "Cues:\n- Keep neutral",
  " * x\n  - y",
  "• dot\n* star",
  "Rest 90 sec",
];

const ALISAN_NOTES =
  "This month we build on the foundation from September. Focus on quality over quantity: every rep should feel controlled.\n\n" +
  "Warm up for 5–10 minutes before each session (bike, brisk walk or skipping). If anything causes sharp pain, stop and message me.\n\n" +
  "Rest 60–90 sec between sets. Breathe out on the effort * never hold your breath.\n\nSee you at the check-in!";

test("Markdown → lines → Markdown is lossless for the corpus", () => {
  for (const md of [...CORPUS, ALISAN_NOTES]) {
    assert.equal(serializeLines(parseLines(md)), md, JSON.stringify(md));
  }
});

test("Markdown → editor DOM → Markdown is lossless for the corpus", () => {
  for (const md of [...CORPUS, ALISAN_NOTES]) {
    assert.equal(domRoundTripCanonical(md), md, JSON.stringify(md));
    assert.equal(domRoundTrip(md), md, JSON.stringify(md));
  }
  // Legacy spellings come back byte-identical too (no stray backslashes).
  for (const md of LEGACY_SPELLINGS) {
    assert.equal(domRoundTrip(md), md, JSON.stringify(md));
  }
  assert.equal(domRoundTrip("a\r\nb"), "a\nb");
});

test("editing one line never respells the others", () => {
  const md = "3*10 reps\n**unclosed\nGoal: x\n  - indented";
  const lines = parseLines(md);
  lines[2] = { kind: "text", inline: [{ type: "text", text: "Goal: y" }] };
  assert.equal(serializeLinesPreserving(lines, md), "3*10 reps\n**unclosed\nGoal: y\n  - indented");
  // Duplicate lines are matched one for one; new lines are canonical.
  const twice = parseLines("2*3\n2*3");
  twice.push({ kind: "text", inline: [{ type: "text", text: "4*5" }] });
  assert.equal(serializeLinesPreserving(twice, "2*3\n2*3"), "2*3\n2*3\n4\\*5");
});

test("bold wrapping only italic is stored as ***x*** instead of losing a mark", () => {
  const tree = [{ type: "bold", children: [{ type: "italic", children: [{ type: "text", text: "x" }] }] }];
  assert.deepEqual(canonicalInline(tree), [{ type: "italic", children: [{ type: "bold", children: [{ type: "text", text: "x" }] }] }]);
  // What Ctrl+B then Ctrl+I leaves in the editor.
  assert.equal(readEditor(editorRoot([el("div", {}, el("b", {}, el("i", {}, "both")), " rest")])), "***both*** rest");
});

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("fuzz: random inline trees survive Markdown and the editor DOM", () => {
  const rand = mulberry32(20261002);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const ALPHABET = ["a", "b", "ç", "İ", " ", " ", "*", "~", "\\", "-", "•", ".", "3", ":", "_"];
  const word = () => Array.from({ length: 1 + Math.floor(rand() * 5) }, () => pick(ALPHABET)).join("");
  const tree = (depth) =>
    Array.from({ length: 1 + Math.floor(rand() * 3) }, () =>
      depth > 0 && rand() < 0.45
        ? { type: pick(["bold", "italic", "strike"]), children: tree(depth - 1) }
        : { type: "text", text: word() },
    );
  for (let i = 0; i < 1500; i++) {
    const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => {
      const r = rand();
      if (r < 0.15) return { kind: "blank" };
      if (r < 0.45) return { kind: "item", marker: pick(["-", "*", "•"]), inline: tree(3) };
      return { kind: "text", inline: tree(3) };
    });
    // Canonical Markdown for these lines; the subset's guarantee is that it is
    // a fixed point, and the editor DOM must preserve it exactly.
    const md = serializeLines(parseLines(serializeLines(lines)));
    assert.equal(serializeLines(parseLines(md)), md, `fixed point: ${JSON.stringify(md)}`);
    assert.equal(domRoundTrip(md), md, `dom: ${JSON.stringify(md)}`);
    // serializeInline always re-parses to its own tree.
    for (const line of lines) {
      if (line.kind === "blank") continue;
      const s = serializeInline(line.inline);
      assert.equal(serializeInline(parseInline(s)), s);
    }
  }
});

test("fuzz: any editor formatting (marks nested in any order) keeps its text and its marks", () => {
  const rand = mulberry32(7);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const word = () => pick(["squat", "slow", "3", "neck", "İpucu", "a b"]);
  const tree = (depth) =>
    Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, i) =>
      depth > 0 && rand() < 0.5
        ? { type: pick(["bold", "italic", "strike"]), children: tree(depth - 1) }
        : { type: "text", text: (i > 0 ? " " : "") + word() + " " },
    );
  const marks = (nodes, acc = new Set()) => {
    for (const n of nodes) {
      if (n.type === "text") continue;
      acc.add(n.type);
      marks(n.children, acc);
    }
    return acc;
  };
  for (let i = 0; i < 800; i++) {
    const inline = tree(3);
    const tags = { bold: "b", italic: "i", strike: "strike" };
    const build = (nodes) => nodes.map((n) => (n.type === "text" ? n.text : el(tags[n.type], {}, ...build(n.children))));
    const md = readEditor(editorRoot([el("div", {}, ...build(inline))]));
    const back = parseLines(md)[0]?.inline ?? [];
    assert.equal(inlineToPlain(back).trim(), inlineToPlain(inline).trim(), md);
    // Every kind of mark the DOM had is still in the stored Markdown.
    assert.deepEqual([...marks(back)].sort(), [...marks(canonicalInline(inline))].sort(), md);
  }
});

// ---------------------------------------------------------------------------
// DOM serializer: editor DOM shapes
// ---------------------------------------------------------------------------

test("linesToDom builds divs, marked-up lists and decorated labels from text nodes", () => {
  const nodes = linesToDom(parseLines("Goal: Strength\n\n* a\n* **b**\n- c\n- "), fakeDoc);
  assert.deepEqual(nodes.map((n) => n.nodeName), ["DIV", "DIV", "UL", "UL"]);
  const [goal, blank, starList, dashList] = nodes;
  const span = goal.childNodes[0];
  assert.equal(span.nodeName, "SPAN");
  assert.equal(span.getAttribute("data-rt-label"), "");
  assert.equal(span.getAttribute("class"), "font-semibold text-brand");
  assert.equal(span.childNodes[0].nodeValue, "Goal");
  assert.equal(goal.childNodes[1].nodeValue, ": Strength");
  assert.deepEqual(blank.childNodes.map((n) => n.nodeName), ["BR"]);
  assert.equal(starList.getAttribute("data-marker"), "*");
  assert.deepEqual(starList.childNodes.map((li) => li.childNodes[0].nodeName), ["#text", "STRONG"]);
  assert.equal(dashList.getAttribute("data-marker"), "-");
  assert.deepEqual(dashList.childNodes[1].childNodes.map((n) => n.nodeName), ["BR"]);
});

test("domToLines reads Chrome contentEditable shapes", () => {
  const cases = [
    // First line as a bare text node, later lines as divs (Chrome after Enter).
    [["abc", el("div", {}, "def"), el("div", {}, el("br")), el("div", {}, "ghi")], "abc\ndef\n\nghi"],
    // Trailing <br> is the browser's placeholder; a second one is a blank line.
    [[el("div", {}, "abc", el("br"))], "abc"],
    [[el("div", {}, "abc", el("br"), el("br"))], "abc\n"],
    [[el("div", {}, "a", el("br"), "b")], "a\nb"],
    [[el("br")], ""],
    [[el("div", {}, el("br")), el("div", {}, el("br"))], "\n"],
    [[], ""],
    // execCommand output (styleWithCSS false).
    [[el("div", {}, el("b", {}, "bold"), " and ", el("i", {}, "it"), " ", el("strike", {}, "x"), el("del", {}, "y"))], "**bold** and *it* ~~xy~~"],
    [[el("div", {}, el("b", {}, "a ", el("i", {}, "b")))], "**a *b***"],
    // Lists: default marker "-", the editor's data-marker, <ol> → "-".
    [[el("ul", {}, el("li", {}, "a"), el("li", {}, el("br")))], "- a\n- "],
    [[el("ul", { "data-marker": "*" }, el("li", {}, "a"), el("li", {}, "b"))], "* a\n* b"],
    [[el("ul", { "data-marker": "bogus" }, el("li", {}, "a"))], "- a"],
    [[el("ol", {}, el("li", {}, "one"), el("li", {}, "two"))], "- one\n- two"],
    [[el("ul", {}, el("li", {}, "a", el("ul", {}, el("li", {}, "nested"))))], "- a\n- nested"],
    [[el("ul", {}, el("li", {}, el("div", {}, "wrapped")))], "- wrapped"],
    // Label decoration is transparent; editor-mode inline styles are noise.
    [[el("div", {}, el("span", { "data-rt-label": "", class: "font-semibold text-brand" }, "Goal:"), " Improve")], "Goal: Improve"],
    [[el("div", {}, el("span", { style: "font-weight: 600; color: rgb(20, 83, 45)" }, "Goal:"), " x")], "Goal: x"],
    [[el("div", {}, el("b", { style: "font-weight: normal" }, "not bold"))], "not bold"],
    // Underline is unsupported (dropped), unknown tags are transparent.
    [[el("div", {}, el("u", {}, "under"), el("font", { color: "red" }, "red"), el("a", { href: "https://x.test" }, "link"))], "underredlink"],
    // pre-wrap text: spaces kept, NBSP → space, "\n" inside text = line break.
    [[el("div", {}, "  two  spaces\u00a0nbsp")], "  two  spaces nbsp"],
    [["a\nb\n"], "a\nb"],
    // Never text from scripts / styles / images / comments.
    [[el("div", {}, "x", el("script", {}, "alert(1)"), el("style", {}, "p{}"), el("img", { src: "x" }), "y")], "xy"],
  ];
  for (const [nodes, expected] of cases) {
    assert.equal(readEditor(editorRoot(nodes)), expected);
  }
  const root = editorRoot([]);
  root.appendChild(new FakeComment("hidden"));
  root.appendChild(new FakeText("visible"));
  assert.equal(readEditor(root), "visible");
});

// ---------------------------------------------------------------------------
// Paste
// ---------------------------------------------------------------------------

test("Google Docs HTML keeps bold / italic / strike and bullets, nothing else", () => {
  const gdocs =
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234-abcd">' +
    '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:700;vertical-align:baseline;">Goal:</span>' +
    '<span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:400;"> Improve </span><span style="font-size:11pt;text-decoration:underline;">neck</span><span style="font-size:11pt;"> strength</span></p>' +
    "<br>" +
    '<ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;">' +
    '<li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" style="line-height:1.38;" role="presentation"><span style="font-size:11pt;font-style:italic;">Keep the neck neutral</span></p></li>' +
    '<li dir="ltr" style="list-style-type:disc;" aria-level="1"><p dir="ltr" role="presentation"><span style="text-decoration:line-through;">old cue</span><span> and </span><span style="font-weight:700;font-style:italic;">both</span></p></li>' +
    "</ul></b>" +
    '<br class="Apple-interchange-newline">';
  assert.equal(pasteHtml(gdocs), "**Goal:** Improve neck strength\n\n- *Keep the neck neutral*\n- ~~old cue~~ and ***both***");
});

test("Word HTML: MsoListParagraph bullets without the Symbol glyph, blank paragraphs kept", () => {
  const word = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><style>p.MsoNormal{margin:0}</style></head><body lang=EN-US>
<!--StartFragment-->
<p class=MsoNormal><b>Cues:<o:p></o:p></b></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>Keep your <i>head</i>
neutral<o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>·<span>&nbsp;&nbsp; </span></span><![endif]>Breathe <s>in</s> out<o:p></o:p></p>
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
<p class=MsoNormal>1 Set × 8 Reps&nbsp; Each Side<o:p></o:p></p>
<!--EndFragment-->
</body></html>`;
  assert.equal(pasteHtml(word), "**Cues:**\n- Keep your *head* neutral\n- Breathe ~~in~~ out\n\n1 Set × 8 Reps Each Side");
});

test("web pages: headings bold, links as text, scripts / images / tables reduced", () => {
  const page =
    "<h2>Warm up</h2><p>Read <a href='https://x.test'>this <strong>guide</strong></a>.<img src=x onerror=alert(1)></p>" +
    "<script>alert(1)</script><style>p{color:red}</style>" +
    "<table><tr><td>Squat</td><td>3 × 8</td></tr></table>" +
    "<ol><li>First</li><li>Second</li></ol>" +
    "<p>  lots   of\n   whitespace  </p><div><b><strong>double bold</strong></b></div>";
  assert.equal(
    pasteHtml(page),
    "**Warm up**\nRead this **guide**.\nSquat 3 × 8\n- First\n- Second\nlots of whitespace\n**double bold**",
  );
  assert.equal(pasteHtml(""), "");
  assert.equal(pasteHtml("<br><br><p>x</p><br>"), "x");
});

test("plain-text paste: our Markdown, WhatsApp markers and bullets", () => {
  const md = (text) => serializeLines(plainTextToLines(text));
  assert.equal(md("*Goal:* keep it _slow_ and ~controlled~"), "**Goal:** keep it *slow* and ~~controlled~~");
  assert.equal(md("*_both_*"), "***both***");
  assert.equal(md("• one\n* two\n- three"), "• one\n* two\n- three");
  assert.equal(md("**already** markdown with *italic*"), "**already** markdown with *italic*");
  assert.equal(md("line one\r\nline two\r\n"), "line one\nline two");
  // Word-internal markers and lonely markers stay literal.
  const literal = plainTextToLines("2*3*4, snake_case_name, ~ 5 min, * , 3 * 5 * 6");
  assert.equal(literal.length, 1);
  assert.equal(inlineToPlain(literal[0].inline), "2*3*4, snake_case_name, ~ 5 min, * , 3 * 5 * 6");
  assert.ok(literal[0].inline.every((n) => n.type === "text"));
  // And the stored Markdown reads back as the same literal text.
  assert.equal(inlineToPlain(parseLines(serializeLines(literal))[0].inline), "2*3*4, snake_case_name, ~ 5 min, * , 3 * 5 * 6");
});

// ---------------------------------------------------------------------------
// Review fixes
// ---------------------------------------------------------------------------

test("indented '* ' text lines are escaped so they never read back as bullets", () => {
  const text = (s) => ({ kind: "text", inline: [{ type: "text", text: s }] });
  for (const s of [" * a", "\t* a", "  * squat", " *\ta", " * "]) {
    const md = serializeLines([text(s)]);
    const back = parseLines(md);
    assert.equal(back.length, 1, JSON.stringify(md));
    assert.equal(back[0].kind, "text", JSON.stringify(md));
    assert.equal(inlineToPlain(back[0].inline), s, JSON.stringify(md));
  }
  // Legacy escaped spelling round-trips byte for byte.
  assert.equal(serializeLines(parseLines("  \\* a")), "  \\* a");
  // A typed " * not a bullet" line in the editor stays a text line.
  const typed = readEditor(editorRoot([el("div", {}, "Note:"), el("div", {}, " * not a bullet")]));
  assert.deepEqual(parseLines(typed).map((l) => l.kind), ["text", "text"]);
  // Marks at the start of a line are untouched.
  assert.equal(serializeLines(parseLines(" *a* b\n**a** b")), " *a* b\n**a** b");
});

test("NBSP after a marker: untouched text is not rewritten, a bullet made from it is kept", () => {
  const md = "Cues:\n-\u00a0Keep neutral";
  assert.deepEqual(parseLines(md).map((l) => l.kind), ["text", "text"]);
  // Focus + blur / switching views with no edit: nothing to emit.
  assert.equal(domRoundTrip(md), md);
  // The coach turns the literal "- Keep" line into a real bullet.
  const edited = [
    { kind: "text", inline: [{ type: "text", text: "Cues:" }] },
    { kind: "item", marker: "-", inline: [{ type: "text", text: "Keep neutral" }] },
  ];
  const saved = serializeLinesPreserving(edited, md);
  assert.equal(saved, "Cues:\n- Keep neutral");
  assert.deepEqual(parseLines(saved).map((l) => l.kind), ["text", "item"]);
  // NBSP-indented "* x" stays a text line on blur.
  assert.equal(domRoundTrip("Cues:\n\u00a0* keep neutral"), "Cues:\n\u00a0* keep neutral");
  assert.deepEqual(parseRichText("Cues:\n\u00a0* keep neutral").map((b) => b.type), ["paragraph"]);
});

test("fuzz: untouched text (NBSP, tabs, markers, labels, escapes) is never rewritten by the editor", () => {
  const rand = mulberry32(424242);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const ALPHABET = ["a", "ç", " ", " ", "\u00a0", "\t", "*", "**", "~~", "~", "\\", "-", "•", "_", "Goal:", "Cues:", "Not:", "3", "\n", "\n"];
  for (let i = 0; i < 20000; i++) {
    const md = Array.from({ length: 1 + Math.floor(rand() * 10) }, () => pick(ALPHABET)).join("");
    assert.equal(domRoundTrip(md), normalizeLineBreaks(md), JSON.stringify(md));
  }
});

test("label decoration: only the word is decorated, the colon and rest are plain text", () => {
  assert.deepEqual(splitLabelPrefix("Cues:"), { lead: "", label: "Cues", rest: ":" });
  assert.deepEqual(splitLabelPrefix("  GOAL :  spaced"), { lead: "  ", label: "GOAL", rest: " :  spaced" });
  assert.deepEqual(splitLabelPrefix("Hedef: güç"), { lead: "", label: "Hedef", rest: ": güç" });
  assert.deepEqual(splitLabelPrefix("İpucu: nefes"), { lead: "", label: "İpucu", rest: ": nefes" });
  assert.equal(splitLabelPrefix("xCues:"), null);
  assert.equal(splitLabelPrefix("Tempo: 3-1-1"), null);
  assert.equal(splitLabelPrefix("Cues"), null);
  assert.equal(splitLabelPrefix(""), null);

  // Finding: text typed at the end of a label line must never land inside
  // the decoration (the editor no longer repairs the DOM after input, which
  // broke native undo). A label line therefore always ENDS outside the span.
  const isLabelSpan = (n) => n.nodeType === 1 && n.getAttribute("data-rt-label") !== null;
  const labelLines = [...CORPUS, "Cues:", "Goal:", "  Note:", "GOAL :", "Hedef:", "Not: yavaş"]
    .flatMap((md) => normalizeLineBreaks(md).split("\n"))
    .filter((line) => parseLines(line)[0]?.kind === "text" && parseLines(line)[0].inline[0]?.type === "text" && splitLabelPrefix(parseLines(line)[0].inline[0].text));
  assert.ok(labelLines.length >= 8, "corpus has label lines");
  for (const md of labelLines) {
    const built = linesToDom(parseLines(md), fakeDoc)[0];
    const spans = built.childNodes.filter(isLabelSpan);
    assert.equal(spans.length, 1, md);
    const [span] = spans;
    // The span holds the label word only: one text node, no colon.
    assert.equal(span.childNodes.length, 1, md);
    assert.equal(span.childNodes[0].nodeType, 3, md);
    assert.ok(!span.childNodes[0].nodeValue.includes(":"), md);
    // Something non-empty follows it, starting with the (optionally spaced) colon.
    const after = built.childNodes[built.childNodes.indexOf(span) + 1];
    assert.equal(after.nodeType, 3, md);
    assert.match(after.nodeValue, /^[ \t]*:/, md);
    // The line's last node is outside the span.
    assert.ok(!isLabelSpan(built.childNodes[built.childNodes.length - 1]), md);
    // And the whole thing reads back exactly.
    assert.equal(domRoundTrip(md), md);
  }

  // The verifier's case: a standalone "Cues:" line ends in a plain text node
  // after the span; typing there (the browser appends to that node) stays
  // plain and outside the decoration, and reads back as plain Markdown.
  const cues = linesToDom(parseLines("Cues:"), fakeDoc)[0];
  assert.deepEqual(cues.childNodes.map((n) => n.nodeName), ["SPAN", "#text"]);
  const tail = cues.childNodes[1];
  assert.equal(tail.nodeValue, ":");
  tail.nodeValue += " keep chin tucked";
  assert.equal(cues.childNodes[0].childNodes[0].nodeValue, "Cues");
  assert.equal(readEditor(editorRoot([cues])), "Cues: keep chin tucked");
  // A label followed by formatting right after the colon: the colon is its own text node.
  const bold = linesToDom(parseLines("Goal:**Bold right after**"), fakeDoc)[0];
  assert.deepEqual(bold.childNodes.map((n) => n.nodeName), ["SPAN", "#text", "STRONG"]);
  assert.equal(bold.childNodes[1].nodeValue, ":");
  // Indented label: indentation, word, colon + rest.
  const indented = linesToDom(parseLines("  Note: indented label"), fakeDoc)[0];
  assert.deepEqual(indented.childNodes.map((n) => n.nodeValue ?? n.childNodes[0].nodeValue), ["  ", "Note", ": indented label"]);

  // Stale shapes the browser may leave until the blur rebuild are still read
  // as plain text: the old whole-label span, text typed into the span, a span
  // left mid-line after Backspace merged two lines.
  assert.equal(readEditor(editorRoot([el("div", {}, el("span", { "data-rt-label": "" }, "Cues: keep"))])), "Cues: keep");
  assert.equal(readEditor(editorRoot([el("div", {}, el("span", { "data-rt-label": "" }, "Cuesx"), ": a")])), "Cuesx: a");
  assert.equal(readEditor(editorRoot([el("div", {}, "abc", el("span", { "data-rt-label": "" }, "Cues"), ":")])), "abcCues:");
});

test("plain-text paste: at most one Enter on each side, extra breaks are blank lines in one fragment", () => {
  const md = (text) => {
    const p = plainTextPaste(text);
    return [p.breaksBefore, serializeLines(p.lines), p.breaksAfter];
  };
  // The coordinator's case: pasted at the end of a line, "WA: …" starts a new line.
  assert.deepEqual(md("\nWA: *hold* 3 sec"), [1, "WA: **hold** 3 sec", 0]);
  assert.deepEqual(md("no breaks"), [0, "no breaks", 0]);
  assert.deepEqual(md("x\n"), [0, "x", 1]);
  // Finding: two breaks were two Enters (the second one, on the new empty
  // bullet, ended the list and the blank line was lost; each was also its
  // own undo step). Now: one Enter, then the blank line inside the fragment.
  const twoBefore = plainTextPaste("\n\nfoo");
  assert.equal(twoBefore.breaksBefore, 1);
  assert.deepEqual(twoBefore.lines.map((l) => l.kind), ["blank", "text"]);
  assert.equal(twoBefore.breaksAfter, 0);
  assert.deepEqual(md("x\n\n"), [0, "x\n", 1]);
  assert.deepEqual(md("\r\n\r\nline one\nline two\n"), [1, "\nline one\nline two", 1]);
  assert.deepEqual(md("\n\n\nfoo\n\n\n"), [1, "\n\nfoo\n\n", 1]);
  // Total line breaks are kept exactly: Enters + blank lines + inner breaks.
  for (const text of ["\nfoo", "\n\nfoo", "foo\n\n", "\n\n- a\n- b\n\n\n", "\n\n**a**\n\nb\n", "x\n\n\n\ny"]) {
    const p = plainTextPaste(text);
    const breaks = p.breaksBefore + p.breaksAfter + Math.max(0, p.lines.length - 1);
    assert.equal(breaks, (text.match(/\n/g) ?? []).length, JSON.stringify(text));
  }
  // Only line breaks: that many Enters, nothing to insert.
  assert.deepEqual(md("\n"), [1, "", 0]);
  assert.deepEqual(md("\n\n\n"), [3, "", 0]);
  assert.deepEqual(md(""), [0, "", 0]);
  // Markdown clipboards too; inner blank lines are kept in the content.
  assert.deepEqual(md("\n**a**\n\nb"), [1, "**a**\n\nb", 0]);
  // plainTextToLines itself is unchanged (trims blank lines at both ends).
  assert.equal(serializeLines(plainTextToLines("\nx\n")), "x");
});
