"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import { LANGS, type Lang } from "@/lib/i18n";
import {
  filenameFromDisposition,
  isAppleTouchDevice,
  savedExportUrl,
  type SavedExportMode,
} from "@/lib/pdf-export-protocol";
import {
  checkExportSession,
  downloadBlob,
  newExportToken,
  openBlobInNewTab,
  openPendingWindow,
  showBlobIn,
  watchExportResult,
} from "@/lib/pdf-download";
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
  /** Which fallback title the server uses when `title` is blank. */
  kind?: "program" | "template";
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
  | {
      mode: "inline";
      getDoc: () => ExportDoc;
      /** The saved record when the editor has NO unsaved changes: then the
       *  export uses the saved (GET) route — a named file, started in the tap. */
      saved?: { mode: SavedExportMode; id: string } | null;
    }
  | { mode: "program" | "template"; id: string }
);

/** A failed snapshot export, and whether it was an expired session. */
class ExportError extends Error {
  constructor(readonly sessionExpired: boolean) {
    super(sessionExpired ? "session expired" : "export failed");
  }
}

/**
 * "Save as PDF" control — opens a tiny language chooser (independent of the UI
 * language), then delivers a standalone program document. Staff-only endpoints
 * back it. Dark-mode correct + localized.
 *
 * The language tap is the user gesture iOS / iPadOS WebKit requires, so the
 * handler never awaits before the download starts (see src/lib/pdf-download.ts):
 *  - `program` / `template` (saved): navigate to the GET route inside the tap;
 *    the server's attachment + filename does the rest, and a result cookie
 *    reports failures back for the red toast.
 *  - `inline` (the editor's unsaved state): POSTed with fetch, because the
 *    editor must never navigate away from unsaved work (its leave guard would
 *    prompt, and an expired session would replace the page). Desktop downloads
 *    the blob; on iPad the target tab is opened inside the tap and shows the
 *    PDF when it arrives.
 * When the menu opens, a staff-session probe runs so an expired session still
 * ends in the red toast rather than a login page.
 */
export default function ProgramExportButton(props: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  /** Result of the session probe started when the menu last opened. */
  const session = useRef<"unknown" | "ok" | "expired">("unknown");
  const probe = useRef(0);
  /** Stops polling for a saved export's result cookie (on unmount / re-export). */
  const stopWatching = useRef<(() => void) | null>(null);

  useEffect(() => () => stopWatching.current?.(), []);

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

  function toggleMenu() {
    if (!open) {
      // Probe the session while the coach picks a language (a second tap).
      const id = ++probe.current;
      session.current = "unknown";
      void checkExportSession().then((ok) => {
        if (id === probe.current && ok !== null) session.current = ok ? "ok" : "expired";
      });
    }
    setOpen((o) => !o);
  }

  /** The language tap. Synchronous up to the point the download starts. */
  function choose(lang: Lang) {
    setOpen(false);
    if (session.current === "expired") {
      toast.error(t("export.sessionExpired"));
      return;
    }
    if (props.mode !== "inline") exportSaved(props.mode, props.id, lang);
    else if (props.saved) exportSaved(props.saved.mode, props.saved.id, lang);
    else void exportSnapshot(lang, props.getDoc());
  }

  function exportSaved(mode: SavedExportMode, id: string, lang: Lang) {
    const token = newExportToken();
    stopWatching.current?.();
    const watch = watchExportResult(token);
    stopWatching.current = watch.cancel;
    setPending(true);
    // A navigation inside the tap: no fetch, no blob, the server names the file.
    window.location.assign(savedExportUrl(mode, id, lang, token));
    void watch.promise.then((result) => {
      setPending(false);
      if (result === "fail") toast.error(t("export.failed"));
    });
  }

  async function exportSnapshot(lang: Lang, doc: ExportDoc) {
    // On iPad / iPhone WebKit, open the target tab NOW, before the first await.
    const target = isAppleTouchDevice(navigator)
      ? openPendingWindow(t("export.preparing"), t("export.pdf"))
      : null;
    setPending(true);
    try {
      const res = await fetch("/admin/export/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...doc, lang }),
      });
      // An expired session is redirected to the login page (200 HTML) — that
      // must not be saved as a .pdf.
      const type = res.headers.get("content-type") ?? "";
      if (res.redirected) throw new ExportError(true);
      if (!res.ok || !type.startsWith("application/pdf")) throw new ExportError(false);

      const blob = await res.blob();
      const filename =
        filenameFromDisposition(res.headers.get("content-disposition")) ??
        `alisanphysio-${lang}.pdf`;
      if (target && !target.closed) {
        showBlobIn(target, blob, filename);
      } else if (isAppleTouchDevice(navigator)) {
        // The window was blocked: offer the PDF behind a fresh tap instead.
        toast(t("export.ready"), {
          action: {
            label: t("export.open"),
            onClick: () => {
              if (!openBlobInNewTab(blob, filename)) downloadBlob(blob, filename);
            },
          },
        });
      } else {
        downloadBlob(blob, filename);
      }
    } catch (err) {
      target?.close();
      const expired = err instanceof ExportError && err.sessionExpired;
      toast.error(t(expired ? "export.sessionExpired" : "export.failed"));
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
        onClick={toggleMenu}
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
                onClick={() => choose(l)}
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
