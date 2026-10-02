/**
 * Renders coaching text written in the small Markdown subset of
 * `@/lib/rich-text` (bold, italic, strikethrough, bullet lists, paragraphs,
 * line breaks, "Goal:" / "Cues:" labels).
 *
 * Pure React elements built from the parsed tree — no hooks and no
 * "use client", so it works in server and client components alike, and no
 * HTML strings, so every character of the stored text is escaped by React.
 * Text colour is inherited: callers decide the tone (muted, foreground…).
 */

import { Fragment, type ReactNode } from "react";
import { parseRichText, richTextExcerpt, type DisplayLine, type InlineNode } from "@/lib/rich-text";

const SIZE = {
  sm: "text-sm leading-relaxed",
  base: "text-base leading-relaxed",
} as const;

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}.${index}`;
    if (node.type === "text") return node.text;
    const children = renderInline(node.children, key);
    if (node.type === "bold") return <strong key={key} className="font-semibold">{children}</strong>;
    if (node.type === "italic") return <em key={key}>{children}</em>;
    return <s key={key}>{children}</s>;
  });
}

function renderLine(line: DisplayLine, key: string): ReactNode {
  const body = renderInline(line.inline, key);
  if (!line.label) return body;
  return (
    <>
      <strong className="font-semibold text-brand">{line.label}</strong>
      {line.inline.length > 0 && " "}
      {body}
    </>
  );
}

export default function RichText({
  value,
  className,
  size = "sm",
}: {
  value: string | null | undefined;
  className?: string;
  size?: "sm" | "base";
}) {
  const blocks = parseRichText(value);
  if (blocks.length === 0) return null;

  return (
    <div className={["min-w-0 space-y-2.5 [overflow-wrap:anywhere]", SIZE[size], className].filter(Boolean).join(" ")}>
      {blocks.map((block, blockIndex) =>
        block.type === "paragraph" ? (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderLine(line, `${blockIndex}.${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        ) : (
          <ul key={blockIndex} className="list-disc space-y-1 pl-5 marker:text-brand">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-0.5">
                {renderLine(item, `${blockIndex}.${itemIndex}`)}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/**
 * One-line plain excerpt (no Markdown markers, labels as "Goal: …") for
 * cards and list rows; pair it with `truncate` / `line-clamp-*` classes.
 */
export function RichTextExcerpt({
  value,
  className,
  maxLength = 0,
}: {
  value: string | null | undefined;
  className?: string;
  maxLength?: number;
}) {
  const excerpt = richTextExcerpt(value, maxLength);
  if (!excerpt) return null;
  return <span className={className}>{excerpt}</span>;
}
