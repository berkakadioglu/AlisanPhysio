/**
 * DOM ⇄ rich-text line model, for the WYSIWYG editor and for paste.
 *
 *   domToLines(root, opts)   editor DOM or pasted HTML → RichLine[]
 *   linesToDom(lines, doc)   RichLine[] → editor DOM (createElement /
 *                            createTextNode only — user text never goes
 *                            through innerHTML)
 *   htmlToLines(html, p)     pasted HTML (Word, Google Docs, web pages…) →
 *                            RichLine[], reduced to the supported subset
 *   plainTextToLines(text)   pasted plain text (our Markdown or WhatsApp
 *                            *bold* _italic_ ~strike~) → RichLine[]
 *
 * Only a minimal node interface is read (nodeType, nodeName, nodeValue,
 * childNodes, getAttribute), so the module runs against a real browser DOM,
 * a DOMParser document, or a tiny fake DOM in Node tests.
 *
 * Invariant (tested): for every Markdown text md in the supported subset,
 *   serializeLines(domToLines(linesToDom(parseLines(md)))) === normalizeLineBreaks(md)
 */

import {
  detectLabel,
  normalizeInline,
  normalizeLineBreaks,
  parseInline,
  parseLines,
  serializeInline,
  serializeLines,
  type InlineMark,
  type InlineNode,
  type ListMarker,
  type RichLine,
} from "./rich-text";

// ---------------------------------------------------------------------------
// Minimal DOM interfaces
// ---------------------------------------------------------------------------

/** The parts of a DOM node domToLines reads. */
export interface DomNodeLike {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly nodeValue: string | null;
  readonly childNodes: ArrayLike<DomNodeLike>;
  getAttribute?(name: string): string | null;
}

/** The parts of a DOM element linesToDom writes. */
export interface DomBuildElement<E, T> {
  appendChild(child: E | T): unknown;
  setAttribute(name: string, value: string): void;
}

/** The document factory linesToDom builds with (a real `document` fits). */
export interface DomBuilder<E extends DomBuildElement<E, T>, T> {
  createElement(tagName: string): E;
  createTextNode(data: string): T;
}

export interface DomParserLike {
  parseFromString(source: string, type: "text/html"): { body: DomNodeLike | null };
}

export interface DomToLinesOptions {
  /**
   * true for pasted HTML: whitespace collapses like a browser renders it,
   * inline styles (Google Docs / Word) count as formatting.
   * false for the editor's own DOM (white-space: pre-wrap): spaces are kept
   * exactly and only formatting tags count.
   */
  collapseWhitespace?: boolean;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

/** Elements whose content never becomes text. */
const IGNORED = new Set([
  "SCRIPT", "STYLE", "TEMPLATE", "HEAD", "TITLE", "META", "LINK", "NOSCRIPT", "IFRAME", "OBJECT",
  "EMBED", "IMG", "SVG", "VIDEO", "AUDIO", "CANVAS", "PICTURE", "SOURCE", "TRACK", "MAP", "AREA",
  "INPUT", "BUTTON", "SELECT", "TEXTAREA", "OPTION", "DATALIST", "MATH", "XML",
]);

/** Elements that start and end a line. */
const BLOCKS = new Set([
  "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "TR", "TABLE", "THEAD",
  "TBODY", "TFOOT", "CAPTION", "SECTION", "ARTICLE", "HEADER", "FOOTER", "NAV", "ASIDE", "MAIN",
  "FIGURE", "FIGCAPTION", "ADDRESS", "DL", "DT", "DD", "HR", "FORM", "FIELDSET", "LEGEND",
  "DETAILS", "SUMMARY", "CENTER", "BODY", "HTML", "LI", "UL", "OL", "DIR", "MENU",
]);
const LISTS = new Set(["UL", "OL", "DIR", "MENU"]);
const HEADINGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const CELLS = new Set(["TD", "TH"]);
const MARKERS: ReadonlySet<string> = new Set<ListMarker>(["-", "*", "•"]);

/** Whitespace a browser collapses (not NBSP). */
const COLLAPSIBLE_ONLY_RE = /^[ \t\n\r\f]*$/;
const COLLAPSIBLE_RUN_RE = /[ \t\n\r\f]+/g;
const NBSP_RE = / /g;

// ---------------------------------------------------------------------------
// DOM → lines
// ---------------------------------------------------------------------------

function parseStyle(attr: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!attr) return map;
  for (const decl of attr.split(";")) {
    const colon = decl.indexOf(":");
    if (colon <= 0) continue;
    map.set(decl.slice(0, colon).trim().toLowerCase(), decl.slice(colon + 1).trim().toLowerCase());
  }
  return map;
}

function isBoldWeight(value: string): boolean {
  if (value.startsWith("bold")) return true; // bold, bolder
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 600;
}

function attr(node: DomNodeLike, name: string): string | null {
  return typeof node.getAttribute === "function" ? node.getAttribute(name) : null;
}

/** Formatting an element applies to its content (tags, plus inline styles for pasted HTML). */
function marksOf(name: string, style: Map<string, string>, fromPaste: boolean): InlineMark[] {
  const marks: InlineMark[] = [];
  const weight = style.get("font-weight");
  const fontStyle = style.get("font-style");
  const decoration = `${style.get("text-decoration") ?? ""} ${style.get("text-decoration-line") ?? ""}`;

  const boldTag = name === "B" || name === "STRONG" || (fromPaste && HEADINGS.has(name));
  // Google Docs wraps whole clipboards in <b style="font-weight:normal">.
  if (boldTag ? weight === undefined || isBoldWeight(weight) : fromPaste && weight !== undefined && isBoldWeight(weight)) {
    marks.push("bold");
  }
  const italicTag = name === "I" || name === "EM";
  if (italicTag ? fontStyle !== "normal" : fromPaste && (fontStyle === "italic" || fontStyle === "oblique")) {
    marks.push("italic");
  }
  if (name === "S" || name === "STRIKE" || name === "DEL" || (fromPaste && decoration.includes("line-through"))) {
    marks.push("strike");
  }
  return marks;
}

type LineContext = { kind: "text" } | { kind: "item"; marker: ListMarker };

interface OpenLine {
  ctx: LineContext;
  root: InlineNode[];
  /** Children arrays of the open marks, root first (mirrors `marks`). */
  path: InlineNode[][];
  hasContent: boolean;
  /** Opened by a line break: dropped if still empty at a block boundary. */
  fromBreak: boolean;
  /** Last appended character was a (collapsed) space. */
  endsWithSpace: boolean;
}

class LineBuilder {
  readonly lines: RichLine[] = [];
  private line: OpenLine | null = null;
  private readonly marks: InlineMark[] = [];
  private readonly ctx: LineContext[] = [{ kind: "text" }];
  private readonly markers: ListMarker[] = [];
  /** Depth of elements that preserve whitespace (PRE, white-space: pre*). */
  private preserveDepth = 0;

  constructor(private readonly collapse: boolean) {}

  run(root: DomNodeLike): RichLine[] {
    this.children(root);
    this.blockEnd();
    return this.lines;
  }

  private children(node: DomNodeLike): void {
    const list = node.childNodes;
    for (let i = 0; i < list.length; i++) this.node(list[i]);
  }

  private node(node: DomNodeLike): void {
    if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE) {
      this.text(node.nodeValue ?? "");
      return;
    }
    if (node.nodeType === DOCUMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE) {
      this.children(node);
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return; // comments, processing instructions…
    this.element(node);
  }

  private element(el: DomNodeLike): void {
    const name = el.nodeName.toUpperCase();
    if (IGNORED.has(name)) return;
    if (name === "BR") {
      this.lineBreak();
      return;
    }

    const style = parseStyle(attr(el, "style"));
    const msoList = style.get("mso-list");
    // Word's list bullet glyph ("·" + spacing) lives in mso-list:Ignore spans.
    if (msoList !== undefined && msoList.startsWith("ignore")) return;
    if (style.get("display") === "none") return;

    // The editor's label decoration ("Goal:") is purely visual.
    const transparent = attr(el, "data-rt-label") !== null;
    const wordListItem =
      this.collapse && (name === "P" || name === "DIV") &&
      ((attr(el, "class") ?? "").includes("MsoListParagraph") || msoList !== undefined);
    const isItem = name === "LI" || wordListItem;
    const isList = LISTS.has(name);
    const isBlock = isItem || isList || BLOCKS.has(name);
    const whiteSpace = style.get("white-space");
    const preserve = this.collapse && (name === "PRE" || (whiteSpace !== undefined && whiteSpace.startsWith("pre")) || whiteSpace === "break-spaces");

    if (isBlock) this.blockStart();
    if (isItem) {
      // An empty line left open (e.g. the parent item of a nested list) gives way.
      if (this.line && !this.line.hasContent) this.line = null;
      const marker = wordListItem ? "-" : this.markers[this.markers.length - 1] ?? "-";
      this.ctx.push({ kind: "item", marker });
      this.openLine();
    }
    if (isList) {
      const declared = attr(el, "data-marker");
      this.markers.push(declared && MARKERS.has(declared) ? (declared as ListMarker) : "-");
    }
    if (CELLS.has(name) && this.line?.hasContent && !this.line.endsWithSpace) this.append(" ");

    let pushed = 0;
    if (!transparent) {
      for (const mark of marksOf(name, style, this.collapse)) {
        // Pasted HTML often nests the same formatting twice (<b><strong>…).
        if (this.collapse && this.marks.includes(mark)) continue;
        this.pushMark(mark);
        pushed++;
      }
    }
    if (preserve) this.preserveDepth++;

    this.children(el);

    if (preserve) this.preserveDepth--;
    for (let i = 0; i < pushed; i++) this.popMark();
    if (isList) this.markers.pop();
    if (isBlock) this.blockEnd();
    if (isItem) this.ctx.pop();
  }

  // -- marks ---------------------------------------------------------------

  private pushMark(mark: InlineMark): void {
    this.marks.push(mark);
    if (!this.line) return;
    const node: InlineNode = { type: mark, children: [] };
    this.line.path[this.line.path.length - 1].push(node);
    this.line.path.push(node.children);
  }

  private popMark(): void {
    this.marks.pop();
    if (this.line && this.line.path.length > 1) this.line.path.pop();
  }

  // -- lines ---------------------------------------------------------------

  private openLine(fromBreak = false): OpenLine {
    const root: InlineNode[] = [];
    const path = [root];
    for (const mark of this.marks) {
      const node: InlineNode = { type: mark, children: [] };
      path[path.length - 1].push(node);
      path.push(node.children);
    }
    this.line = {
      ctx: this.ctx[this.ctx.length - 1],
      root,
      path,
      hasContent: false,
      fromBreak,
      endsWithSpace: false,
    };
    return this.line;
  }

  private emitLine(): void {
    const line = this.line;
    if (!line) return;
    this.line = null;
    let inline = canonicalInline(line.root);
    if (this.collapse) inline = trimInline(inline);
    if (line.ctx.kind === "item") this.lines.push({ kind: "item", marker: line.ctx.marker, inline });
    else this.lines.push(inline.length === 0 ? { kind: "blank" } : { kind: "text", inline });
  }

  /** A block starts: finish the current line unless it is still empty. */
  private blockStart(): void {
    if (this.line?.hasContent) this.emitLine();
  }

  /** A block ends: finish the current line; a still-empty line opened by a
   *  trailing <br> was only the browser's placeholder. */
  private blockEnd(): void {
    if (!this.line) return;
    if (this.line.fromBreak && !this.line.hasContent) this.line = null;
    else this.emitLine();
  }

  private lineBreak(): void {
    if (!this.line) this.openLine();
    this.emitLine();
    this.openLine(true);
  }

  // -- text ----------------------------------------------------------------

  private append(s: string): void {
    const line = this.line ?? this.openLine();
    const target = line.path[line.path.length - 1];
    const last = target[target.length - 1];
    if (last && last.type === "text") last.text += s;
    else target.push({ type: "text", text: s });
    line.endsWithSpace = s.endsWith(" ");
  }

  private text(raw: string): void {
    if (!this.collapse || this.preserveDepth > 0) {
      // Editor DOM (white-space: pre-wrap) or <pre>: keep spaces, "\n" breaks.
      const parts = raw.replace(NBSP_RE, " ").replace(/\r\n?/g, "\n").split("\n");
      parts.forEach((part, index) => {
        if (index > 0) this.lineBreak();
        if (part) {
          this.append(part);
          this.line!.hasContent = true;
        }
      });
      return;
    }
    // Pasted HTML: whitespace collapses; whitespace-only text at the start of
    // a line (indentation between tags) renders as nothing.
    if (COLLAPSIBLE_ONLY_RE.test(raw) && !this.line?.hasContent) return;
    const hasContent = !COLLAPSIBLE_ONLY_RE.test(raw);
    let s = raw.replace(COLLAPSIBLE_RUN_RE, " ").replace(NBSP_RE, " ").replace(/ {2,}/g, " ");
    if (this.line?.endsWithSpace && s.startsWith(" ")) s = s.slice(1);
    if (!s) return;
    this.append(s);
    if (hasContent) this.line!.hasContent = true;
  }
}

/** True when the tree survives Markdown unchanged (serializeInline drops a
 *  mark it cannot express). */
function expressible(nodes: InlineNode[]): boolean {
  return JSON.stringify(normalizeInline(parseInline(serializeInline(nodes)))) === JSON.stringify(nodes);
}

/**
 * normalizeInline, plus the rewrites Markdown needs when the editor DOM holds
 * formatting it cannot spell (otherwise serialising would drop a mark):
 *   - bold wrapping nothing but italic ("<b><i>x</i></b>", what Ctrl+B then
 *     Ctrl+I produces) can only be written "***x***", which reads back as
 *     italic(bold(x)) — so it is stored that way round;
 *   - a mark inside the same mark ("<s>a <s>b</s></s>") is the same formatting
 *     and is flattened.
 * Trees that already survive Markdown are left exactly as they are.
 */
export function canonicalInline(nodes: InlineNode[]): InlineNode[] {
  const normal = normalizeInline(nodes);
  if (expressible(normal)) return normal;
  const rewrite = (list: InlineNode[], active: ReadonlySet<InlineMark>): InlineNode[] =>
    list.flatMap((node): InlineNode[] => {
      if (node.type === "text") return [node];
      if (active.has(node.type)) return rewrite(node.children, active);
      const children = rewrite(node.children, new Set([...active, node.type]));
      const only = children.length === 1 ? children[0] : null;
      if (node.type === "bold" && only && only.type === "italic") {
        return [{ type: "italic", children: [{ type: "bold", children: only.children }] }];
      }
      return [{ type: node.type, children }];
    });
  return normalizeInline(rewrite(normal, new Set()));
}

/** Trim whitespace at both ends of a normalised inline tree (whitespace is
 *  already outside marks there). */
function trimInline(nodes: InlineNode[]): InlineNode[] {
  const out = nodes.slice();
  const first = out[0];
  if (first && first.type === "text") out[0] = { type: "text", text: first.text.replace(/^\s+/u, "") };
  const lastIndex = out.length - 1;
  const last = out[lastIndex]; // re-read: may be the trimmed first node
  if (last && last.type === "text") out[lastIndex] = { type: "text", text: last.text.replace(/\s+$/u, "") };
  return out.filter((n) => n.type !== "text" || n.text !== "");
}

/**
 * Read the editor's DOM (or a parsed paste) back into lines. The root itself
 * is treated as a block container.
 */
export function domToLines(root: DomNodeLike, options: DomToLinesOptions = {}): RichLine[] {
  return new LineBuilder(options.collapseWhitespace ?? false).run(root);
}

function nbspToSpace(nodes: InlineNode[]): InlineNode[] {
  return nodes.map((node): InlineNode =>
    node.type === "text"
      ? { type: "text", text: node.text.replace(NBSP_RE, " ") }
      : { type: node.type, children: nbspToSpace(node.children) },
  );
}

/**
 * serializeLines that keeps the original spelling of unchanged lines. Every
 * output line whose canonical Markdown equals that of a line in `original`
 * is written exactly as it was typed there ("3*10", "  - item", "\\*x"), so
 * editing one line never rewrites the others. Lines are parsed independently,
 * so swapping in an equivalent spelling never changes the meaning.
 */
export function serializeLinesPreserving(lines: RichLine[], original: string | null | undefined): string {
  const pool = new Map<string, string[]>();
  const source = normalizeLineBreaks(original);
  if (source !== "") {
    for (const raw of source.split("\n")) {
      // Key each stored line by what the editor reads back for it: the line
      // kind of the raw text (an NBSP after "-" does NOT make a bullet), with
      // NBSP turned into a space inside the text (the DOM read does that).
      // Keying by the NBSP-replaced string instead would pool "-<NBSP>x" (a
      // text line) under the bullet "- x". canonicalInline: the DOM read
      // flattens the odd trees some legacy spellings parse to (a mark nested
      // in the same mark), so the key must too.
      const read = parseLines(raw).map((line): RichLine =>
        line.kind === "blank" ? line : { ...line, inline: canonicalInline(nbspToSpace(line.inline)) },
      );
      const canonical = serializeLines(read);
      const spellings = pool.get(canonical);
      if (spellings) spellings.push(raw);
      else pool.set(canonical, [raw]);
    }
  }
  return lines
    .map((line) => {
      const canonical = serializeLines([line]);
      return pool.get(canonical)?.shift() ?? canonical;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Lines → DOM
// ---------------------------------------------------------------------------

const TAG: Record<InlineMark, string> = { bold: "strong", italic: "em", strike: "s" };

/** Classes of the label decoration (also referenced here so Tailwind emits them). */
export const LABEL_CLASS = "font-semibold text-brand";

function appendInline<E extends DomBuildElement<E, T>, T>(parent: E, nodes: InlineNode[], doc: DomBuilder<E, T>): void {
  for (const node of nodes) {
    if (node.type === "text") {
      if (node.text) parent.appendChild(doc.createTextNode(node.text));
      continue;
    }
    const el = doc.createElement(TAG[node.type]);
    appendInline(el, node.children, doc);
    parent.appendChild(el);
  }
}

/** A line-start label split into the parts the editor builds. */
export interface LabelParts {
  /** Indentation before the label ("  "). */
  lead: string;
  /** The decorated part: the label word only ("Goal", "GOAL", "Hedef"). */
  label: string;
  /** Everything after the word, colon included (": Improve…", " :  spaced"). */
  rest: string;
}

/** Split text that starts with a "Goal:" / "Cues:" / "Hedef:"… label (same
 *  detection as the renderers); null when it doesn't start with one. */
export function splitLabelPrefix(text: string): LabelParts | null {
  const { label } = detectLabel([{ type: "text", text }]);
  if (!label) return null;
  const lead = /^[ \t]*/.exec(text)![0];
  const end = lead.length + label.length;
  if (text.slice(lead.length, end) !== label) return null;
  return { lead, label, rest: text.slice(end) };
}

/**
 * Text-line content, with the word of a leading "Goal:" wrapped in a
 * decoration span that still contains the literal text (so reading it back
 * is exact). Only the WORD is decorated: the colon and the rest of the line
 * follow as a plain text node, so a label line always ends outside the span.
 * The caret at the end of "Cues:" therefore sits in plain text and whatever
 * is typed there (or after Enter) never takes on the label's bold green look
 * — without the editor having to touch the DOM after a native edit (which
 * would put the browser's undo history out of step with the DOM).
 */
function appendTextLine<E extends DomBuildElement<E, T>, T>(parent: E, inline: InlineNode[], doc: DomBuilder<E, T>): void {
  const first = inline[0];
  const parts = first && first.type === "text" ? splitLabelPrefix(first.text) : null;
  if (!parts) {
    appendInline(parent, inline, doc);
    return;
  }
  if (parts.lead) parent.appendChild(doc.createTextNode(parts.lead));
  const span = doc.createElement("span");
  span.setAttribute("data-rt-label", "");
  span.setAttribute("class", LABEL_CLASS);
  span.appendChild(doc.createTextNode(parts.label));
  parent.appendChild(span);
  // Never empty: a label always has its colon after the word.
  parent.appendChild(doc.createTextNode(parts.rest));
  appendInline(parent, inline.slice(1), doc);
}

/**
 * Build the editor DOM for lines: a <div> per text line (blank → <div><br>),
 * consecutive bullet lines with the same marker → one <ul data-marker> of
 * <li>. Returns the top-level nodes in order.
 */
export function linesToDom<E extends DomBuildElement<E, T>, T>(lines: RichLine[], doc: DomBuilder<E, T>): E[] {
  const out: E[] = [];
  let list: { el: E; marker: ListMarker } | null = null;
  for (const line of lines) {
    if (line.kind === "item") {
      if (!list || list.marker !== line.marker) {
        const el = doc.createElement("ul");
        el.setAttribute("data-marker", line.marker);
        list = { el, marker: line.marker };
        out.push(el);
      }
      const li = doc.createElement("li");
      if (line.inline.length === 0) li.appendChild(doc.createElement("br"));
      else appendInline(li, line.inline, doc);
      list.el.appendChild(li);
      continue;
    }
    list = null;
    const div = doc.createElement("div");
    if (line.kind === "blank" || line.inline.length === 0) div.appendChild(doc.createElement("br"));
    else appendTextLine(div, line.inline, doc);
    out.push(div);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Paste
// ---------------------------------------------------------------------------

/** Drop blank lines at both ends of a pasted fragment. */
function trimBlankLines(lines: RichLine[]): RichLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].kind === "blank") start++;
  while (end > start && lines[end - 1].kind === "blank") end--;
  return lines.slice(start, end);
}

/** Pasted HTML → lines in the supported subset (parsed inertly: a DOMParser
 *  document runs no scripts and loads no images). */
export function htmlToLines(html: string, parser: DomParserLike): RichLine[] {
  const body = parser.parseFromString(html, "text/html").body;
  if (!body) return [];
  return trimBlankLines(domToLines(body, { collapseWhitespace: true }));
}

const PLAIN_ITEM_RE = /^[ \t]*([-*•])[ \t]+(.*)$/;
const WHATSAPP_MARKS: Record<string, InlineMark> = { "*": "bold", _: "italic", "~": "strike" };
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

/** WhatsApp-style inline formatting: *bold*, _italic_, ~strike~. A marker
 *  opens only after a non-word character and closes only before one, so
 *  "2*3*4" and snake_case_names stay literal. */
function parseWhatsApp(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let text = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const mark = WHATSAPP_MARKS[c];
    const prev = src[i - 1];
    const next = src[i + 1];
    if (mark && next !== undefined && !/\s/u.test(next) && next !== c && (prev === undefined || !WORD_CHAR_RE.test(prev))) {
      let close = -1;
      for (let j = i + 2; j < src.length; j++) {
        if (src[j] !== c) continue;
        const after = src[j + 1];
        if (!/\s/u.test(src[j - 1]) && (after === undefined || !WORD_CHAR_RE.test(after))) {
          close = j;
          break;
        }
      }
      if (close > 0) {
        if (text) out.push({ type: "text", text });
        text = "";
        out.push({ type: mark, children: parseWhatsApp(src.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
    }
    text += c;
    i++;
  }
  if (text) out.push({ type: "text", text });
  return canonicalInline(out);
}

/**
 * Pasted plain text → lines. Text that already uses our Markdown ("**" or
 * "~~") is read as Markdown; anything else gets WhatsApp formatting. Lines
 * starting with "- ", "* " or "• " are bullets either way.
 */
export function plainTextToLines(text: string): RichLine[] {
  const src = normalizeLineBreaks(text);
  if (src.includes("**") || src.includes("~~")) return trimBlankLines(parseLines(src));
  const lines = src.split("\n").map((line): RichLine => {
    if (line.trim() === "") return line === "" ? { kind: "blank" } : { kind: "text", inline: [{ type: "text", text: line }] };
    const item = PLAIN_ITEM_RE.exec(line);
    if (item) return { kind: "item", marker: item[1] as ListMarker, inline: parseWhatsApp(item[2]) };
    return { kind: "text", inline: parseWhatsApp(line) };
  });
  return trimBlankLines(lines);
}

/** How the editor inserts pasted plain text at the caret. */
export interface PlainTextPaste {
  /** Enters at the caret before inserting `lines`: 1 when the text starts
   *  with a line break ("\nWA: x" pasted at the end of a line starts a new
   *  line), 0 otherwise. Text made only of line breaks is that many Enters. */
  breaksBefore: number;
  /** One fragment, inserted in a single step: the content lines
   *  (plainTextToLines), with every further leading / trailing line break as
   *  a blank line — not as more Enters, which would each be an undo step
   *  and, in a bullet, end the list at the second one. */
  lines: RichLine[];
  /** Enters after inserting `lines`: 1 when the text ends with a line break. */
  breaksAfter: number;
}

/**
 * Pasted plain text → what to insert, so pasting keeps the text's line
 * structure like a plain text field would: "\nX" at the end of "abc" gives
 * "abc" / "X", "X\n" gives "abcX" / "", "\n\nX" gives "abc" / "" / "X".
 */
export function plainTextPaste(text: string): PlainTextPaste {
  const src = normalizeLineBreaks(text);
  const content = plainTextToLines(src);
  const before = /^\n*/.exec(src)![0].length;
  if (content.length === 0) return { breaksBefore: /^\n*$/.test(src) ? before : 0, lines: content, breaksAfter: 0 };
  const after = /\n*$/.exec(src)![0].length;
  const blanks = (n: number): RichLine[] => Array.from({ length: Math.max(0, n - 1) }, () => ({ kind: "blank" }));
  return {
    breaksBefore: Math.min(before, 1),
    lines: [...blanks(before), ...content, ...blanks(after)],
    breaksAfter: Math.min(after, 1),
  };
}
