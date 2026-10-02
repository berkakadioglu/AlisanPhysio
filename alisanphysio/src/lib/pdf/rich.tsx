import { Fragment, type ReactNode } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  inlineToPlain,
  parseRichText,
  type DisplayLine,
  type InlineNode,
  type RichBlock,
} from "@/lib/rich-text";
import { pdfSafeInline, wrappedLines } from "./pdf-text";

/**
 * Coaching text (programme notes, exercise cues) in the PDF: the same Markdown
 * subset as every other surface (src/lib/rich-text.ts), drawn with react-pdf
 * primitives — nested <Text> for bold / italic / strike, labels ("Goal",
 * "Cues") bold in the brand green, bullets as rows with a hanging indent.
 */

/** A react-pdf style object (the renderer doesn't export the type itself). */
export type Style = Parameters<typeof StyleSheet.create>[0][string];

// ---------------------------------------------------------------------------
// Text → display blocks, cleaned for the PDF fonts
// ---------------------------------------------------------------------------

function cleanInline(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    if (n.type === "text") {
      const text = pdfSafeInline(n.text, "Inter");
      if (text) out.push({ type: "text", text });
    } else {
      const children = cleanInline(n.children);
      if (children.length > 0) out.push({ type: n.type, children });
    }
  }
  return out;
}

/** Trim whitespace at one end of a line (it may sit inside a mark). */
function trimEdge(nodes: InlineNode[], end: "start" | "end"): InlineNode[] {
  const out = [...nodes];
  while (out.length > 0) {
    const i = end === "start" ? 0 : out.length - 1;
    const n = out[i];
    if (n.type === "text") {
      const text = end === "start" ? n.text.trimStart() : n.text.trimEnd();
      if (text) {
        out[i] = { type: "text", text };
        break;
      }
    } else {
      const children = trimEdge(n.children, end);
      if (children.length > 0) {
        out[i] = { type: n.type, children };
        break;
      }
    }
    out.splice(i, 1);
  }
  return out;
}

function cleanLine(line: DisplayLine): DisplayLine | null {
  const label = pdfSafeInline(line.label, "Inter").trim() || null;
  const inline = trimEdge(trimEdge(cleanInline(line.inline), "start"), "end");
  return label || inline.length > 0 ? { label, inline } : null;
}

/**
 * Stored Markdown → display blocks for the PDF. Parsed first, then every text
 * node is cleaned for the Inter faces (pdfSafeInline — never pdfSafe, which
 * trims and would eat the spaces around "**bold** text"); lines and blocks
 * left empty (e.g. emoji only) are dropped.
 */
export function pdfRichBlocks(md: string | null | undefined): RichBlock[] {
  const blocks: RichBlock[] = [];
  for (const block of parseRichText(md)) {
    if (block.type === "paragraph") {
      const lines = block.lines.map(cleanLine).filter((l): l is DisplayLine => !!l);
      if (lines.length > 0) blocks.push({ type: "paragraph", lines });
    } else {
      const items = block.items.map(cleanLine).filter((l): l is DisplayLine => !!l);
      if (items.length > 0) blocks.push({ type: "list", items });
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Metrics + height estimates
// ---------------------------------------------------------------------------

export interface RichMetrics {
  fontSize: number;
  /** Line height as a multiple of fontSize. */
  lineHeight: number;
  /** Space between blocks (paragraphs, lists). */
  blockGap: number;
  /** Space between list items. */
  itemGap: number;
}

/** Width of the "•" column — the hanging indent of a list item. */
export const BULLET_INDENT = 10;

const linePlain = (line: DisplayLine) =>
  (line.label ? `${line.label} ` : "") + inlineToPlain(line.inline);

/** A paragraph ending in a bare label ("Cues" on its own line): a heading for
 *  what follows, so it sits as close to it as two list items. */
const endsWithBareLabel = (block: RichBlock) =>
  block.type === "paragraph" && block.lines[block.lines.length - 1].inline.length === 0;

/** Space above a block that follows `prev` (the normal gap when unknown). */
export function gapAfter(prev: RichBlock | undefined, m: RichMetrics): number {
  return prev && endsWithBareLabel(prev) ? m.itemGap : m.blockGap;
}

/** Estimated height of one block laid out `width` points wide. */
export function estBlockHeight(block: RichBlock, width: number, m: RichMetrics): number {
  const lineH = m.fontSize * m.lineHeight;
  if (block.type === "paragraph") {
    const text = block.lines.map(linePlain).join("\n");
    return wrappedLines(text, width, "Inter", 400, m.fontSize) * lineH;
  }
  return block.items.reduce(
    (sum, item, i) =>
      sum +
      (i > 0 ? m.itemGap : 0) +
      wrappedLines(linePlain(item), width - BULLET_INDENT, "Inter", 400, m.fontSize) * lineH,
    0,
  );
}

/** Estimated height of a run of blocks, gaps included. */
export function estRichHeight(blocks: RichBlock[], width: number, m: RichMetrics): number {
  return blocks.reduce(
    (sum, block, i) =>
      sum + (i > 0 ? gapAfter(blocks[i - 1], m) : 0) + estBlockHeight(block, width, m),
    0,
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RichStyles {
  /** Body text (font size, colour, lineHeight). */
  body: Style;
  /** A label ("Goal", "Cues"): bold, brand colour. */
  label: Style;
}

const MARK_STYLE: Record<Exclude<InlineNode["type"], "text">, Style> = {
  bold: { fontWeight: 700 },
  italic: { fontStyle: "italic" },
  strike: { textDecoration: "line-through" },
};

function Inline({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return nodes.map((n, i) =>
    n.type === "text" ? (
      <Fragment key={i}>{n.text}</Fragment>
    ) : (
      <Text key={i} style={MARK_STYLE[n.type]}>
        <Inline nodes={n.children} />
      </Text>
    ),
  );
}

function Line({ line, s }: { line: DisplayLine; s: RichStyles }) {
  return (
    <>
      {line.label && <Text style={s.label}>{line.label}</Text>}
      {line.label && line.inline.length > 0 && " "}
      <Inline nodes={line.inline} />
    </>
  );
}

const rowStyle: Style = { flexDirection: "row" };
const bulletStyle: Style = { width: BULLET_INDENT, flexShrink: 0 };
const itemTextStyle: Style = { flexGrow: 1, flexShrink: 1, flexBasis: 0 };

/** One list item: "•" in a fixed column, the text wrapping beside it. */
export function ListItem({
  item,
  s,
  style,
  wrap = false,
}: {
  item: DisplayLine;
  s: RichStyles;
  style?: Style;
  wrap?: boolean;
}) {
  return (
    <View style={style ? [rowStyle, style] : rowStyle} wrap={wrap}>
      <Text style={[s.body, bulletStyle]}>•</Text>
      <Text style={[s.body, itemTextStyle]}>
        <Line line={item} s={s} />
      </Text>
    </View>
  );
}

/** A paragraph: its lines in one <Text>, joined by line breaks. */
export function Paragraph({
  lines,
  s,
  style,
}: {
  lines: DisplayLine[];
  s: RichStyles;
  style?: Style;
}) {
  return (
    <Text style={style ? [s.body, style] : s.body}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && "\n"}
          <Line line={line} s={s} />
        </Fragment>
      ))}
    </Text>
  );
}

/** One block (inside an unbreakable parent, or one that wraps as a whole). */
export function Block({
  block,
  s,
  m,
  marginTop,
}: {
  block: RichBlock;
  s: RichStyles;
  m: RichMetrics;
  /** Space above the block (0 for the first one). */
  marginTop: number;
}) {
  const gap: Style | undefined = marginTop > 0 ? { marginTop } : undefined;
  if (block.type === "paragraph") return <Paragraph lines={block.lines} s={s} style={gap} />;
  return (
    <View style={gap}>
      {block.items.map((item, i) => (
        <ListItem key={i} item={item} s={s} style={i > 0 ? { marginTop: m.itemGap } : undefined} />
      ))}
    </View>
  );
}

/** A run of blocks for an unbreakable container. */
export function RichBlocks({ blocks, s, m }: { blocks: RichBlock[]; s: RichStyles; m: RichMetrics }) {
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} s={s} m={m} marginTop={i > 0 ? gapAfter(blocks[i - 1], m) : 0} />
      ))}
    </>
  );
}

/**
 * Blocks as separate page-level nodes, so long text flows across pages: a
 * paragraph splits between its lines; each list item stays whole unless it is
 * itself taller than `atomicMax` (then it may split too).
 */
export function flowingBlockParts({
  blocks,
  s,
  m,
  width,
  atomicMax,
  key,
  indent = 0,
  firstGap = false,
  prev,
}: {
  blocks: RichBlock[];
  s: RichStyles;
  m: RichMetrics;
  /** Width of the text column (for the per-item height estimate). */
  width: number;
  atomicMax: number;
  key: string;
  /** Left indent of the column (page-level parts aren't inside it). */
  indent?: number;
  /** Space above the first block too (it follows other text). */
  firstGap?: boolean;
  /** The block drawn just before these, if any (sets the first gap). */
  prev?: RichBlock;
}): ReactNode[] {
  const parts: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const before = bi > 0 ? blocks[bi - 1] : prev;
    const blockGap = bi > 0 || firstGap ? gapAfter(before, m) : 0;
    if (block.type === "paragraph") {
      parts.push(
        <Paragraph
          key={`${key}-${bi}`}
          lines={block.lines}
          s={s}
          style={{ marginLeft: indent, marginTop: blockGap }}
        />,
      );
      return;
    }
    block.items.forEach((item, ii) => {
      const tall =
        wrappedLines(linePlain(item), width - BULLET_INDENT, "Inter", 400, m.fontSize) *
          m.fontSize *
          m.lineHeight >
        atomicMax;
      parts.push(
        <ListItem
          key={`${key}-${bi}-${ii}`}
          item={item}
          s={s}
          wrap={tall}
          style={{ marginLeft: indent, marginTop: ii === 0 ? blockGap : m.itemGap }}
        />,
      );
    });
  });
  return parts;
}
