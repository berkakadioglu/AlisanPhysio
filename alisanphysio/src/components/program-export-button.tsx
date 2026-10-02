"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import { LANGS, type Lang } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";

/** A single exercise as the editor holds it (strings ok — the server coerces). */
export interface ExportExercise {
  name: string;
  sets: number | string | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
}
export interface ExportDoc {
  title: string;
  notes: string | null;
  monthStart: string | null;
  clientName: string | null;
  days: { title: string; exercises: ExportExercise[] }[];
}

type Props = {
  className?: string;
  /** Icon-only trigger (for dense rows / cards). */
  compact?: boolean;
  /** Which edge the dropdown aligns to (default "right"). Use "left" when the
   *  trigger sits near the left edge so the menu doesn't clip off-screen. */
  align?: "left" | "right";
} & (
  | { mode: "inline"; getDoc: () => ExportDoc }
  | { mode: "program" | "template"; id: string }
);

/**
 * "Save as PDF" control — opens a tiny language chooser (independent of the UI
 * language), then downloads a standalone program document. Two flavours:
 * `inline` POSTs the editor's live state; `program`/`template` GET a saved one
 * by id. Staff-only endpoints back it. Dark-mode correct + localized.
 */
export default function ProgramExportButton(props: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(lang: Lang) {
    setOpen(false);
    setPending(true);
    try {
      const res =
        props.mode === "inline"
          ? await fetch("/admin/export/program", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...props.getDoc(), lang }),
            })
          : await fetch(`/admin/export/${props.mode}/${props.id}?lang=${lang}`);
      // An expired session is redirected to the login page (200 HTML) — that
      // must not be saved as a .pdf.
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || res.redirected || !type.startsWith("application/pdf"))
        throw new Error("export failed");

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const filename =
        cd.match(/filename="?([^"]+)"?/)?.[1] ?? `alisanphysio-${lang}.pdf`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      toast.error(t("export.failed"));
    } finally {
      setPending(false);
    }
  }

  const compactClass =
    "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-brand disabled:cursor-not-allowed disabled:opacity-60";
  const fullClass =
    "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60";
  const triggerClass = props.className ?? (props.compact ? compactClass : fullClass);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={props.compact ? t("export.pdf") : undefined}
        title={props.compact ? t("export.pdf") : undefined}
        className={triggerClass}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <FileDown className="h-4 w-4" aria-hidden />
        )}
        {!props.compact && (pending ? t("export.generating") : t("export.pdf"))}
        {!props.compact && !pending && (
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <ul
          role="menu"
          className={`absolute ${
            props.align === "left" ? "left-0" : "right-0"
          } z-30 mt-1.5 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lift`}
        >
          <li className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
            {t("export.chooseLanguage")}
          </li>
          {LANGS.map((l) => (
            <li key={l} role="none">
              <button
                role="menuitem"
                type="button"
                onClick={() => run(l)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-pill hover:text-brand"
              >
                {t(`lang.${l}`)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
