/**
 * Coaching-text formatting: a deliberately small Markdown subset.
 *
 *   **bold**   *italic*   ~~strikethrough~~   "- item" bullet lines,
 *   paragraphs (blank line) and line breaks (single newline).
 *
 * Nothing else — no headings, links, images or HTML. Text is stored as plain
 * Markdown in the existing text columns (programme notes, exercise / template /
 * library instructions) and every surface (editor, client dashboard, PDF)
 * renders from the trees produced here. This module is pure: it never builds
 * HTML strings, so a renderer that maps nodes to React elements (or react-pdf
 * <Text>) escapes everything by construction.
 *
 * Legacy text written before formatting existed improves automatically,
 * without rewriting stored data:
 *   - lines starting with "* " or "• " are bullets too (the marker is kept, so
 *     an edited legacy list serialises back with the marker Alişan typed);
 *   - "Goal:", "Cues:", "Note:" (and Turkish equivalents) at the start of a
 *     line become a label (renderers show it bold, in the brand green, with
 *     the colon dropped);
 *   - Windows / old-Mac / phone line breaks are normalised to "\n".
 *
 * Two models:
 *   - RichLine[]  — lossless, one entry per source line. The editor round-trips
 *                   through it: serializeLines(parseLines(md)) === md for every
 *                   text in the supported subset.
 *   - RichBlock[] — display grouping (paragraphs, lists, labels) for renderers.
 */

export type InlineMark = "bold" | "italic" | "strike";

export type InlineNode =
  | { type: "text"; text: string }
  | { type: InlineMark; children: InlineNode[] };

export type ListMarker = "-" | "*" | "•";

export type RichLine =
  | { kind: "blank" }
  | { kind: "text"; inline: InlineNode[] }
  | { kind: "item"; marker: ListMarker; inline: InlineNode[] };

/** A rendered line: an optional label ("Goal") and its inline content. */
export interface DisplayLine {
  label: string | null;
  inline: InlineNode[];
}

export type RichBlock =
  | { type: "paragraph"; lines: DisplayLine[] }
  | { type: "list"; items: DisplayLine[] };

const DELIMITER: Record<InlineMark, string> = { bold: "**", italic: "*", strike: "~~" };

/** Characters a backslash can escape. Any other backslash is literal. */
const ESCAPABLE = new Set(["\\", "*", "~", "-", "•"]);

/** "- item", "* item", "• item" (leading indentation tolerated, then dropped). */
const ITEM_RE = /^[ \t]*([-*•])[ \t]+(.*)$/;
/**
 * A text line that would be read back as a list item unless escaped. "*" is
 * included: escapeText leaves a "*" with whitespace on both sides unescaped
 * ("3 * 5"), and leading indentation counts as whitespace (" * a").
 */
const ITEM_LOOKALIKE_RE = /^([ \t]*)([-*•])([ \t])/;

/**
 * "Goal:", "Cues:", "Note:" (singular/plural) and the Turkish "Hedef:",
 * "İpucu:/İpuçları:", "Not:" — only at the very start of a line.
 */
const LABEL_RE =
  /^[ \t]*((?:goal|cue|note)s?|hedef(?:ler)?|[İIi]pucu|[İIi]puçları|not(?:lar)?)[ \t]*:[ \t]*/iu;

// ---------------------------------------------------------------------------
// Line breaks
// ---------------------------------------------------------------------------

/** CRLF / CR / NEL / Unicode line + paragraph separators → "\n". */
export function normalizeLineBreaks(src: string | null | undefined): string {
  return (src ?? "").replace(/\r\n?|[\x85\p{Zl}\p{Zp}]/gu, "\n");
}

// ---------------------------------------------------------------------------
// Inline parsing — a compact version of CommonMark's delimiter algorithm
// (flanking rules + "rule of 3"), so stray asterisks in legacy text such as
// "3 * 5" stay literal, while "**bold**", "*italic*", "***both***" and
// intraword "foo**bar**baz" work as people expect.
// ---------------------------------------------------------------------------

interface TextTok {
  t: "text";
  s: string;
}
interface DelimTok {
  t: "delim";
  ch: "*" | "~";
  /** Characters still unmatched (they print literally). */
  n: number;
  /** Original run length (rule of 3). */
  orig: number;
  open: boolean;
  close: boolean;
  /** Marks this run opens, outermost first (consumed from its right end). */
  opens: InlineMark[];
  /** Marks this run closes, innermost first (consumed from its left end). */
  closes: InlineMark[];
}
type Tok = TextTok | DelimTok;

const isSpace = (c: string | undefined) => c === undefined || /\s/u.test(c);
const isPunct = (c: string | undefined) => c !== undefined && /[\p{P}\p{S}]/u.test(c);

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let text = "";
  const flush = () => {
    if (text) toks.push({ t: "text", s: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length && ESCAPABLE.has(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    if (c === "*" || c === "~") {
      let j = i;
      while (j < src.length && src[j] === c) j++;
      const n = j - i;
      // Strikethrough is exactly "~~"; a single "~" (or "~~~") is just text.
      if (c === "~" && n !== 2) {
        text += src.slice(i, j);
        i = j;
        continue;
      }
      const prev = i > 0 ? src[i - 1] : undefined;
      const next = j < src.length ? src[j] : undefined;
      const left = !isSpace(next) && (!isPunct(next) || isSpace(prev) || isPunct(prev));
      const right = !isSpace(prev) && (!isPunct(prev) || isSpace(next) || isPunct(next));
      flush();
      toks.push({ t: "delim", ch: c, n, orig: n, open: left, close: right, opens: [], closes: [] });
      i = j;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return toks;
}

function matchDelimiters(toks: Tok[]): void {
  for (let ci = 0; ci < toks.length; ci++) {
    const closer = toks[ci];
    if (closer.t !== "delim" || !closer.close) continue;
    while (closer.n > 0) {
      let found = -1;
      for (let oi = ci - 1; oi >= 0; oi--) {
        const op = toks[oi];
        if (op.t !== "delim" || op.ch !== closer.ch || !op.open || op.n === 0) continue;
        if (
          op.ch === "*" &&
          (op.close || closer.open) &&
          (op.orig + closer.orig) % 3 === 0 &&
          !(op.orig % 3 === 0 && closer.orig % 3 === 0)
        )
          continue;
        found = oi;
        break;
      }
      if (found < 0) break;
      const op = toks[found] as DelimTok;
      if (closer.ch === "~" && (op.n < 2 || closer.n < 2)) break;
      const use = closer.ch === "~" ? 2 : op.n >= 2 && closer.n >= 2 ? 2 : 1;
      const mark: InlineMark = closer.ch === "~" ? "strike" : use === 2 ? "bold" : "italic";
      op.n -= use;
      closer.n -= use;
      op.opens.unshift(mark);
      closer.closes.push(mark);
      // Delimiters strictly between a matched pair can no longer match.
      for (let k = found + 1; k < ci; k++) {
        const between = toks[k];
        if (between.t === "delim") {
          between.open = false;
          between.close = false;
        }
      }
    }
  }
}

function pushText(target: InlineNode[], s: string): void {
  if (!s) return;
  const last = target[target.length - 1];
  if (last && last.type === "text") last.text += s;
  else target.push({ type: "text", text: s });
}

/** Parse one line of inline Markdown into a tree. Never throws. */
export function parseInline(src: string): InlineNode[] {
  const toks = tokenize(src);
  matchDelimiters(toks);
  const root: InlineNode[] = [];
  const stack: InlineNode[][] = [root];
  for (const tok of toks) {
    const cur = stack[stack.length - 1];
    if (tok.t === "text") {
      pushText(cur, tok.s);
      continue;
    }
    for (let k = 0; k < tok.closes.length; k++) if (stack.length > 1) stack.pop();
    pushText(stack[stack.length - 1], tok.ch.repeat(tok.n));
    for (const mark of tok.opens) {
      const parent = stack[stack.length - 1];
      const el: InlineNode = { type: mark, children: [] };
      parent.push(el);
      stack.push(el.children);
    }
  }
  return root;
}

// ---------------------------------------------------------------------------
// Inline normalisation + serialisation
// ---------------------------------------------------------------------------

/** Plain text of an inline tree. */
export function inlineToPlain(nodes: InlineNode[]): string {
  let out = "";
  for (const n of nodes) out += n.type === "text" ? n.text : inlineToPlain(n.children);
  return out;
}

function cloneInline(nodes: InlineNode[]): InlineNode[] {
  return nodes.map((n) =>
    n.type === "text" ? { type: "text", text: n.text } : { type: n.type, children: cloneInline(n.children) },
  );
}

/** Strip leading whitespace out of a subtree; returns the stripped text. */
function takeLeadingSpace(nodes: InlineNode[]): string {
  let taken = "";
  while (nodes.length > 0) {
    const first = nodes[0];
    if (first.type === "text") {
      const m = /^\s+/u.exec(first.text);
      if (!m) return taken;
      taken += m[0];
      first.text = first.text.slice(m[0].length);
      if (first.text) return taken;
      nodes.shift();
    } else {
      taken += takeLeadingSpace(first.children);
      if (first.children.length > 0) return taken;
      nodes.shift();
    }
  }
  return taken;
}

function takeTrailingSpace(nodes: InlineNode[]): string {
  let taken = "";
  while (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    if (last.type === "text") {
      const m = /\s+$/u.exec(last.text);
      if (!m) return taken;
      taken = m[0] + taken;
      last.text = last.text.slice(0, -m[0].length);
      if (last.text) return taken;
      nodes.pop();
    } else {
      taken = takeTrailingSpace(last.children) + taken;
      if (last.children.length > 0) return taken;
      nodes.pop();
    }
  }
  return taken;
}

/**
 * Canonical inline tree: adjacent text merged, empty marks dropped,
 * whitespace moved outside marks ("**bold **" → "**bold** "), adjacent
 * siblings with the same mark merged. Idempotent; parser output is already
 * canonical for everything people actually type.
 */
export function normalizeInline(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      pushText(out, node.text);
      continue;
    }
    const children = normalizeInline(node.children);
    const lead = takeLeadingSpace(children);
    const trail = takeTrailingSpace(children);
    pushText(out, lead);
    if (children.length > 0) {
      const prev = out[out.length - 1];
      if (prev && prev.type === node.type) {
        prev.children = normalizeInline([...prev.children, ...children]);
      } else {
        out.push({ type: node.type, children });
      }
    }
    pushText(out, trail);
  }
  return out.filter((n) => n.type !== "text" || n.text !== "");
}

function sameInline(a: InlineNode[], b: InlineNode[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.type !== y.type) return false;
    if (x.type === "text") {
      if ((y as { text: string }).text !== x.text) return false;
    } else if (!sameInline(x.children, (y as { children: InlineNode[] }).children)) return false;
  }
  return true;
}

type EscapeLevel = "minimal" | "full";

/**
 * Escape text for Markdown. "minimal" leaves characters that can never act as
 * markup ("3 * 5", "~5 min", "~~~") untouched so legacy text keeps its look;
 * serializeInline verifies the result and falls back to "full" when needed.
 */
function escapeText(s: string, level: EscapeLevel): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    const prev = s[i - 1];
    if (c === "\\") {
      // A backslash only needs escaping when it could escape what follows.
      out += level === "full" || next === undefined || ESCAPABLE.has(next) ? "\\\\" : "\\";
    } else if (c === "*") {
      const inert = level === "minimal" && prev !== undefined && next !== undefined && /\s/u.test(prev) && /\s/u.test(next);
      out += inert ? "*" : "\\*";
    } else if (c === "~") {
      let end = i;
      while (s[end] === "~") end++;
      const run = end - i;
      // Only "~~" is markup; a different run next to a strike mark could merge
      // with its delimiter, which the round-trip check catches.
      const literal = level === "minimal" && run !== 2;
      out += (literal ? "~" : "\\~").repeat(run);
      i = end - 1;
    } else {
      out += c;
    }
  }
  return out;
}

function writeInline(nodes: InlineNode[], level: EscapeLevel): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += escapeText(n.text, level);
    else out += DELIMITER[n.type] + writeInline(n.children, level) + DELIMITER[n.type];
  }
  return out;
}

/** Every way of removing exactly one mark from the tree (DFS order). */
function* withOneMarkRemoved(nodes: InlineNode[]): Generator<InlineNode[]> {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === "text") continue;
    yield normalizeInline([...cloneInline(nodes.slice(0, i)), ...cloneInline(n.children), ...cloneInline(nodes.slice(i + 1))]);
    for (const inner of withOneMarkRemoved(n.children)) {
      yield normalizeInline([
        ...cloneInline(nodes.slice(0, i)),
        { type: n.type, children: inner },
        ...cloneInline(nodes.slice(i + 1)),
      ]);
    }
  }
}

function tryWrite(nodes: InlineNode[]): string | null {
  for (const level of ["minimal", "full"] as const) {
    const s = writeInline(nodes, level);
    if (sameInline(normalizeInline(parseInline(s)), nodes)) return s;
  }
  return null;
}

/**
 * Inline tree → Markdown. The result always parses back to the same
 * (normalised) tree: escaping is minimal when that is unambiguous and full
 * otherwise; in the rare case a mark cannot be expressed at all (e.g. bold
 * text that starts with punctuation glued to a word), that one mark is dropped
 * and the text is kept.
 */
export function serializeInline(nodes: InlineNode[]): string {
  let candidate = normalizeInline(cloneInline(nodes));
  for (let guard = 0; guard < 64; guard++) {
    const direct = tryWrite(candidate);
    if (direct !== null) return direct;
    let next: InlineNode[] | null = null;
    for (const option of withOneMarkRemoved(candidate)) {
      if (tryWrite(option) !== null) {
        next = option;
        break;
      }
    }
    // Nothing single-step works: drop the first mark and keep going.
    candidate = next ?? withOneMarkRemoved(candidate).next().value ?? [{ type: "text", text: inlineToPlain(candidate) }];
  }
  return escapeText(inlineToPlain(candidate), "full");
}

// ---------------------------------------------------------------------------
// Lines (lossless editor model)
// ---------------------------------------------------------------------------

/** Markdown → one RichLine per source line. */
export function parseLines(src: string | null | undefined): RichLine[] {
  const text = normalizeLineBreaks(src);
  if (text === "") return [];
  return text.split("\n").map((line): RichLine => {
    if (line === "") return { kind: "blank" };
    const item = ITEM_RE.exec(line);
    if (item) return { kind: "item", marker: item[1] as ListMarker, inline: parseInline(item[2]) };
    return { kind: "text", inline: parseInline(line) };
  });
}

/** RichLine[] → Markdown. Inverse of parseLines for the supported subset. */
export function serializeLines(lines: RichLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === "blank") return "";
      const body = serializeInline(line.inline);
      if (line.kind === "item") return `${line.marker} ${body}`;
      // A text line must not be read back as a bullet ("- not a list").
      return body.replace(ITEM_LOOKALIKE_RE, "$1\\$2$3");
    })
    .join("\n");
}

/** Canonical Markdown for any input (normalised line breaks + inline). */
export function normalizeRichText(src: string | null | undefined): string {
  return serializeLines(parseLines(src));
}

// ---------------------------------------------------------------------------
// Display model
// ---------------------------------------------------------------------------

/** A leading "Goal:" / "Cues:" / "Note:" label, split off its line. */
export function detectLabel(inline: InlineNode[]): DisplayLine {
  const first = inline[0];
  if (first && first.type === "text") {
    const m = LABEL_RE.exec(first.text);
    if (m) {
      const rest = first.text.slice(m[0].length);
      return {
        label: m[1],
        inline: rest ? [{ type: "text", text: rest }, ...inline.slice(1)] : inline.slice(1),
      };
    }
  }
  return { label: null, inline };
}

/**
 * Markdown → display blocks: consecutive text lines form a paragraph (joined
 * by line breaks), consecutive bullet lines form a list, blank or
 * whitespace-only lines separate blocks. Labels are detected on text lines.
 */
export function parseRichText(src: string | null | undefined): RichBlock[] {
  const blocks: RichBlock[] = [];
  let current: RichBlock | null = null;
  for (const line of parseLines(src)) {
    if (line.kind === "blank" || (line.kind === "text" && inlineToPlain(line.inline).trim() === "")) {
      current = null;
      continue;
    }
    if (line.kind === "item") {
      if (current?.type !== "list") {
        current = { type: "list", items: [] };
        blocks.push(current);
      }
      current.items.push({ label: null, inline: line.inline });
      continue;
    }
    if (current?.type !== "paragraph") {
      current = { type: "paragraph", lines: [] };
      blocks.push(current);
    }
    current.lines.push(detectLabel(line.inline));
  }
  return blocks;
}

/** True when the text has nothing visible to render. */
export function isRichTextEmpty(src: string | null | undefined): boolean {
  return parseRichText(src).length === 0;
}

function displayLineToPlain(line: DisplayLine): string {
  const text = inlineToPlain(line.inline).trim();
  return line.label ? (text ? `${line.label}: ${text}` : `${line.label}:`) : text;
}

/**
 * Plain text without Markdown markers: paragraphs separated by a blank line,
 * line breaks kept, bullets as "• item". Labels keep their colon ("Goal: …").
 */
export function richTextToPlain(src: string | null | undefined): string {
  return parseRichText(src)
    .map((block) =>
      block.type === "paragraph"
        ? block.lines.map(displayLineToPlain).join("\n")
        : block.items.map((item) => `• ${displayLineToPlain(item)}`).join("\n"),
    )
    .join("\n\n");
}

/** One-line plain excerpt (whitespace collapsed), optionally length-capped. */
export function richTextExcerpt(src: string | null | undefined, maxLength = 0): string {
  const flat = richTextToPlain(src).replace(/\s+/gu, " ").trim();
  if (maxLength <= 0 || flat.length <= maxLength) return flat;
  return `${flat.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
