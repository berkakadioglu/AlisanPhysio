"use client";

import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { singleLine, singleLineCaret } from "./day-ops";

const supportsFieldSizing = () =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

/**
 * A large inline-editable title that WRAPS instead of clipping: a one-row
 * <textarea> that grows with its content (CSS `field-sizing: content`, with a
 * scrollHeight fallback for browsers without it). It stays one logical line —
 * Enter never inserts a newline and pasted line breaks become spaces.
 *
 * The normalising happens in the DOM too, with the caret kept in place:
 * otherwise React writes the (different) controlled value back and the caret
 * jumps to the end — after a paste, or an Android keyboard's Enter (which
 * arrives as an input event, not as an Enter keydown).
 */
export default function TitleField({
  value,
  onValueChange,
  className,
  onKeyDown,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "rows" | "children"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Fallback auto-grow: on every value change and whenever the width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing()) return;
    const fit = () => {
      el.style.height = "auto";
      // scrollHeight excludes the borders; border-box height includes them.
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return; // our own height change
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  // Android / IME Enter: cancel the line break before it reaches the value
  // (where cancellable; onChange normalises whatever still gets through).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") e.preventDefault();
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  return (
    <textarea
      enterKeyHint="done"
      {...rest}
      ref={ref}
      rows={1}
      value={value}
      aria-multiline={false}
      onChange={(e) => {
        const el = e.currentTarget;
        const raw = el.value;
        const next = singleLine(raw);
        if (next !== raw) {
          const caret = singleLineCaret(raw, el.selectionEnd);
          el.value = next; // so React has nothing to write back
          el.setSelectionRange(caret, caret);
        }
        onValueChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault();
        onKeyDown?.(e);
      }}
      className={`block resize-none overflow-hidden [field-sizing:content] [overflow-wrap:anywhere] ${className ?? ""}`}
    />
  );
}
