"use client";

/**
 * WYSIWYG editor for coaching text (bold, italic, strikethrough, bullet
 * lists, paragraphs). Controlled by a Markdown string in the subset of
 * `@/lib/rich-text`; the contentEditable DOM is built from it with
 * createElement / createTextNode (never innerHTML with user text) and read
 * back with `domToLines` on every edit.
 *
 * - onChange fires only after a real edit, so untouched (legacy) text is
 *   never rewritten.
 * - Paste and drop are reduced to the supported subset (Word, Google Docs,
 *   WhatsApp, web pages); unsupported formatting commands are blocked.
 * - "Text view" shows / edits the stored Markdown in a plain textarea.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Bold, Code, Italic, List, Strikethrough, Type } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import { normalizeLineBreaks, parseLines, type RichLine } from "@/lib/rich-text";
import {
  domToLines,
  htmlToLines,
  linesToDom,
  plainTextPaste,
  serializeLinesPreserving,
} from "@/lib/rich-text-dom";

type Command = "bold" | "italic" | "strikeThrough" | "insertUnorderedList";
type ActiveState = Record<Command, boolean>;

const INACTIVE: ActiveState = { bold: false, italic: false, strikeThrough: false, insertUnorderedList: false };

/** Native editing actions outside the supported subset. */
const BLOCKED_INPUT = new Set([
  "formatUnderline", "formatSuperscript", "formatSubscript", "formatJustifyFull", "formatJustifyCenter",
  "formatJustifyRight", "formatJustifyLeft", "formatIndent", "formatOutdent", "formatRemove",
  "formatSetBlockTextDirection", "formatSetInlineTextDirection", "formatBackColor", "formatFontColor",
  "formatFontName", "insertOrderedList", "insertHorizontalRule", "insertLink", "insertFromDrop",
]);

/** A line holding only a typed "- " / "* " becomes a bullet. */
const BULLET_SHORTCUT_RE = /^[-*][  ]$/;

const subscribeNever = () => () => {};
/** How the platform spells the shortcut modifier (server render: "Ctrl"). */
const modifierKey = () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl");
const serverModifierKey = () => "Ctrl";

function setsEqual(a: ActiveState, b: ActiveState): boolean {
  return (Object.keys(a) as Command[]).every((key) => a[key] === b[key]);
}

const EXEC_TAGS: Record<string, string> = { b: "strong", i: "em", strike: "s" };
/** execCommand writes <b>/<i>/<strike>, linesToDom builds <strong>/<em>/<s>:
 *  the same formatting, so not a reason to rebuild the DOM. (Text in innerHTML
 *  is escaped, so only real tags match.) */
const sameTags = (html: string) => html.replace(/<(\/?)(b|i|strike)>/g, (_, slash: string, tag: string) => `<${slash}${EXEC_TAGS[tag]}>`);

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
  minRows = 3,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  minRows?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const generatedId = useId();
  const editorId = id ?? `${generatedId}-editor`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** The Markdown the editor DOM currently represents (null = not built yet). */
  const shownRef = useRef<string | null>(null);
  /** The Markdown the DOM was last built from: unchanged lines keep its spelling. */
  const baseRef = useRef("");
  const savedRangeRef = useRef<Range | null>(null);
  const composingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const [mode, setMode] = useState<"rich" | "text">("rich");
  const [active, setActive] = useState<ActiveState>(INACTIVE);
  const [focused, setFocused] = useState(false);
  /** IME composition in progress: the DOM holds text `value` doesn't have yet. */
  const [composing, setComposing] = useState(false);
  const modKey = useSyncExternalStore(subscribeNever, modifierKey, serverModifierKey);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** Rebuild the editor DOM from Markdown (no onChange). */
  const render = useCallback((markdown: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.replaceChildren(...linesToDom(parseLines(markdown), document));
    shownRef.current = markdown;
    baseRef.current = markdown;
  }, []);

  /** Read the DOM back; report it only when the Markdown actually changed. */
  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const markdown = serializeLinesPreserving(domToLines(el, { collapseWhitespace: false }), baseRef.current);
    const shown = shownRef.current;
    // Same text (legacy CRLF line breaks aside): nothing was edited.
    if (shown !== null && (markdown === shown || markdown === normalizeLineBreaks(shown))) return;
    shownRef.current = markdown;
    onChangeRef.current(markdown);
  }, []);

  // External value (first render, parent reset, text view edits) → DOM.
  useLayoutEffect(() => {
    if (mode !== "rich") return;
    if (shownRef.current !== value) render(value);
  }, [value, mode, render]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Mount-only: autoFocus is an initial-render prop, like the DOM attribute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toolbar state follows the caret while the editor has focus.
  useEffect(() => {
    if (!focused || mode !== "rich") return;
    function onSelectionChange() {
      const el = editorRef.current;
      const selection = window.getSelection();
      if (!el || !selection || selection.rangeCount === 0 || !el.contains(selection.anchorNode)) return;
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
      const next: ActiveState = { ...INACTIVE };
      for (const command of Object.keys(INACTIVE) as Command[]) {
        try {
          next[command] = document.queryCommandState(command);
        } catch {
          next[command] = false;
        }
      }
      setActive((prev) => (setsEqual(prev, next) ? prev : next));
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [focused, mode]);

  // Block native formatting the Markdown subset can't hold (underline from a
  // context menu, ordered lists, links…). React has no onBeforeInput with
  // inputType, so this is a native listener.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    function onBeforeInput(event: InputEvent) {
      if (BLOCKED_INPUT.has(event.inputType)) event.preventDefault();
    }
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  /** Focus the editor and put back the selection it had (toolbar via keyboard). */
  function restoreSelection() {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    el.focus();
    const range = savedRangeRef.current;
    const selection = window.getSelection();
    if (range && selection && el.contains(range.startContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function run(command: Command) {
    if (mode !== "rich") return;
    restoreSelection();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command, false);
    emit();
    const next = { ...active };
    try {
      next[command] = document.queryCommandState(command);
    } catch {
      /* state refreshes on the next selection change */
    }
    setActive(next);
  }

  /** Insert lines at the caret (paste). */
  function insertLines(lines: RichLine[]) {
    if (lines.length === 0) return;
    const holder = document.createElement("div");
    const nodes = linesToDom(lines, document);
    if (lines.length === 1 && lines[0].kind === "text") {
      // A single line goes in inline, inside the current line.
      holder.append(...Array.from(nodes[0].childNodes));
    } else {
      holder.append(...nodes);
    }
    // insertHTML keeps the browser's undo history. The HTML is serialised
    // from nodes built with createTextNode, so all text in it is escaped.
    document.execCommand("styleWithCSS", false, "false");
    const inserted = document.execCommand("insertHTML", false, holder.innerHTML);
    if (!inserted) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        fragment.append(...Array.from(holder.childNodes));
        const last = fragment.lastChild;
        range.insertNode(fragment);
        if (last) {
          range.setStartAfter(last);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    emit();
  }

  /** Enter at the caret (a new line, or a new bullet inside a list). Only a
   *  pasted text's first leading / trailing break (or a paste made of nothing
   *  but line breaks) takes this path; further breaks are blank lines inside
   *  the one inserted fragment (see plainTextPaste). */
  function insertBreaks(count: number) {
    for (let i = 0; i < count; i++) document.execCommand("insertParagraph", false);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const lines = html ? htmlToLines(html, new DOMParser()) : [];
    if (lines.length > 0) {
      insertLines(lines);
      return;
    }
    if (!text) return;
    // Plain text keeps its line structure: a leading line break starts a new
    // line before the first pasted line instead of being dropped (which would
    // glue that line onto the one the caret is in), a trailing one ends it.
    // At most one Enter on each side; extra breaks travel as blank lines in
    // the single inserted fragment.
    const paste = plainTextPaste(text);
    insertBreaks(paste.breaksBefore);
    insertLines(paste.lines);
    insertBreaks(paste.breaksAfter);
    emit();
  }

  /** "- " or "* " typed on an empty line → bullet list. */
  function bulletShortcut() {
    const el = editorRef.current;
    const selection = window.getSelection();
    if (!el || !selection || !selection.isCollapsed || !selection.anchorNode) return false;
    let block: Node | null = selection.anchorNode;
    while (block && block !== el && !(block instanceof HTMLElement && /^(DIV|P|LI)$/.test(block.nodeName))) {
      block = block.parentNode;
    }
    if (!block || block.nodeName === "LI") return false;
    if (!BULLET_SHORTCUT_RE.test(block.textContent ?? "")) return false;
    const range = document.createRange();
    range.selectNodeContents(block);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false);
    document.execCommand("insertUnorderedList", false);
    return true;
  }

  function onInput(event: FormEvent<HTMLDivElement>) {
    const native = event.nativeEvent as InputEvent;
    if (composingRef.current || native.isComposing) return;
    if (native.inputType === "insertText" && native.data === " ") bulletShortcut();
    // No DOM repair here: changing nodes the browser's last editing command
    // touched puts its undo history out of step (Ctrl+Z then leaves stray
    // text). Labels are built so typing after "Cues:" lands in plain text
    // (see appendTextLine); stale decorations are normalised on blur.
    emit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLocaleLowerCase("en");
    if (!event.shiftKey && key === "b") {
      event.preventDefault();
      run("bold");
    } else if (!event.shiftKey && (key === "i" || key === "ı" || key === "i̇")) {
      event.preventDefault();
      run("italic");
    } else if (event.shiftKey && key === "x") {
      event.preventDefault();
      run("strikeThrough");
    } else if (key === "u") {
      event.preventDefault(); // underline isn't part of the format
    }
  }

  function onFocus() {
    setFocused(true);
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
    } catch {
      /* older browsers: the default separator is fine */
    }
  }

  function onBlur() {
    setFocused(false);
    setActive(INACTIVE);
    emit();
  }

  /**
   * Focus left the whole editor (toolbar included): normalise the DOM and
   * refresh the "Goal:" decorations — only when the structure really differs.
   * Rebuilding moves the caret to the start and clears the native undo
   * history, so it is skipped while the editor is about to get focus back:
   * when only the browser window / tab lost focus (switching apps to copy
   * something), or when focus moved into this editor's own toolbar
   * (keyboard: Shift+Tab to Bold must still bold the selection).
   */
  function onWrapperBlur(event: FocusEvent<HTMLDivElement>) {
    if (mode !== "rich") return;
    const next = event.relatedTarget as Node | null;
    if (next && wrapperRef.current?.contains(next)) return;
    if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
    const el = editorRef.current;
    if (!el || shownRef.current === null) return;
    const holder = document.createElement("div");
    holder.append(...linesToDom(parseLines(shownRef.current), document));
    if (sameTags(holder.innerHTML) !== sameTags(el.innerHTML)) render(shownRef.current);
  }

  function toggleMode() {
    if (mode === "rich") {
      emit();
      setMode("text");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } else {
      setMode("rich");
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  }

  const minHeight = `calc(${Math.max(1, minRows)} * 1.625em + 1.25rem)`;
  const buttons: { command: Command; label: string; keys: string | null; Icon: typeof Bold }[] = [
    { command: "bold", label: t("rt.bold"), keys: `${modKey}+B`, Icon: Bold },
    { command: "italic", label: t("rt.italic"), keys: `${modKey}+I`, Icon: Italic },
    { command: "strikeThrough", label: t("rt.strike"), keys: `${modKey}+Shift+X`, Icon: Strikethrough },
    { command: "insertUnorderedList", label: t("rt.bulletList"), keys: null, Icon: List },
  ];
  const textMode = mode === "text";
  const label = ariaLabel ?? placeholder ?? "";

  return (
    <div
      ref={wrapperRef}
      onBlur={onWrapperBlur}
      className={[
        "min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition",
        "focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        role="toolbar"
        aria-label={t("rt.toolbar")}
        aria-controls={textMode ? `${editorId}-markdown` : editorId}
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-background/40 px-1.5 py-1"
      >
        {buttons.map(({ command, label: buttonLabel, keys, Icon }) => {
          const title = keys ? t("rt.withShortcut", { label: buttonLabel, keys }) : buttonLabel;
          return (
            <button
              key={command}
              type="button"
              aria-label={buttonLabel}
              aria-pressed={!textMode && active[command]}
              aria-keyshortcuts={keys ? keys.replace("⌘", "Meta").replace("Ctrl", "Control") : undefined}
              title={title}
              disabled={textMode}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(command)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-brand-tint aria-pressed:text-brand sm:h-8 sm:w-8"
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          );
        })}
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleMode}
          title={textMode ? t("rt.formattedViewHint") : t("rt.textViewHint")}
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:min-h-8"
        >
          {textMode ? <Type className="h-3.5 w-3.5" aria-hidden /> : <Code className="h-3.5 w-3.5" aria-hidden />}
          {textMode ? t("rt.formattedView") : t("rt.textView")}
        </button>
      </div>

      <div className="relative" hidden={textMode}>
        {value === "" && placeholder && !composing && (
          <p
            aria-hidden
            className="pointer-events-none absolute inset-x-3.5 top-2.5 truncate text-sm leading-relaxed text-subtle-foreground"
          >
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          id={editorId}
          role="textbox"
          aria-multiline="true"
          aria-label={label || undefined}
          aria-placeholder={placeholder}
          contentEditable={!textMode}
          suppressContentEditableWarning
          spellCheck
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onCompositionStart={() => {
            composingRef.current = true;
            setComposing(true);
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            setComposing(false);
            emit();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "none";
          }}
          onDrop={(event) => event.preventDefault()}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{ minHeight }}
          className="min-w-0 whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none [overflow-wrap:anywhere] [&_li]:pl-0.5 [&_li]:marker:text-brand [&_b]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>

      {textMode && (
        <div>
          <textarea
            ref={textareaRef}
            id={`${editorId}-markdown`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={label ? t("rt.textViewAria", { label }) : undefined}
            spellCheck={false}
            style={{ minHeight }}
            rows={Math.max(1, minRows)}
            className="block w-full resize-y bg-transparent px-3.5 py-2.5 font-mono text-sm leading-relaxed text-foreground outline-none [overflow-wrap:anywhere]"
          />
          <p className="border-t border-border px-3.5 py-1.5 font-mono text-[11px] text-subtle-foreground [overflow-wrap:anywhere]">
            {t("rt.textViewHelp")}
          </p>
        </div>
      )}
    </div>
  );
}
