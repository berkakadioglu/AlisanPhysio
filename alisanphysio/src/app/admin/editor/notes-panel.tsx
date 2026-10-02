"use client";

import { useId, useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { richTextExcerpt } from "@/lib/rich-text";
import { useI18n } from "@/app/i18n-provider";
import RichTextEditor from "@/components/rich-text-editor";

/**
 * Programme notes as a quiet collapsible panel under the editor header.
 * Collapsed (the default) it shows a one-line preview of the notes, or a muted
 * prompt when empty; expanded it shows the formatting editor.
 */
export default function NotesPanel({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const editorId = useId();
  const excerpt = richTextExcerpt(value, 160);

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:px-5"
      >
        <NotebookPen className="h-4 w-4 flex-none text-brand" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="flex-none text-sm font-semibold text-foreground">
            {t("ed.notes.label")}
          </span>
          {!open && (
            <span
              className={`min-w-0 truncate text-sm ${
                excerpt ? "text-muted-foreground" : "text-subtle-foreground"
              }`}
            >
              {excerpt || placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-none text-muted-foreground transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <div id={panelId} hidden={!open} className="border-t border-border px-4 pb-4 pt-3 sm:px-5">
        {open && (
          <RichTextEditor
            id={editorId}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            ariaLabel={t("ed.notes.label")}
            minRows={4}
            autoFocus
          />
        )}
      </div>
    </section>
  );
}
