"use client";

import { useId } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleDot, Loader2 } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import ProgramExportButton, { type ExportDoc } from "@/components/program-export-button";
import OverflowMenu, { type OverflowMenuItem } from "./overflow-menu";
import TitleField from "./title-field";

/** What the "Saved" status line says. */
export type SaveStatus =
  | { kind: "saving" }
  | { kind: "dirty" }
  | { kind: "new" }
  | { kind: "saved"; at: string | null };

export interface MonthControl {
  value: string;
  options: { value: string; label: string }[];
  onChange: (month: string) => void;
}

/**
 * The editor header: back link, the programme / saved-day title as a large
 * inline-editable heading, the month select (client programmes), the save
 * status line, PDF export, primary Save and a quiet ⋯ menu.
 */
export default function EditorHeader({
  backHref,
  backLabel,
  title,
  onTitleChange,
  titleLabel,
  titlePlaceholder,
  titleWarning,
  month,
  status,
  getExportDoc,
  onSave,
  saving,
  locked = false,
  menuLabel,
  menuItems,
}: {
  /** The back link (like every link) is covered by the editor's leave guard. */
  backHref: string;
  backLabel: string;
  title: string;
  onTitleChange: (title: string) => void;
  titleLabel: string;
  titlePlaceholder: string;
  titleWarning?: string | null;
  month?: MonthControl | null;
  status: SaveStatus;
  getExportDoc: () => ExportDoc;
  onSave: () => void;
  saving: boolean;
  /** Read-only title / month (while the first save moves to the edit URL). */
  locked?: boolean;
  menuLabel: string;
  menuItems: OverflowMenuItem[];
}) {
  const { t } = useI18n();
  const titleId = useId();
  const monthId = useId();
  const warningId = useId();

  const statusView =
    status.kind === "saving"
      ? { Icon: Loader2, text: t("ed.status.saving"), tone: "text-muted-foreground", spin: true }
      : status.kind === "dirty"
        ? { Icon: CircleDot, text: t("ed.status.dirty"), tone: "text-warning", spin: false }
        : status.kind === "new"
          ? { Icon: CircleDot, text: t("ed.status.new"), tone: "text-subtle-foreground", spin: false }
          : {
              Icon: Check,
              text: status.at ? t("ed.status.savedAt", { time: status.at }) : t("ed.status.saved"),
              tone: "text-brand",
              spin: false,
            };

  return (
    <header className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:min-h-0"
      >
        <span aria-hidden>←</span>
        <span className="truncate">{backLabel}</span>
      </Link>

      {/* The title gets the full width (it wraps instead of clipping); the
          month / status line and the actions share the row under it. */}
      <div className="min-w-0">
        <label htmlFor={titleId} className="sr-only">
          {titleLabel}
        </label>
        <TitleField
          id={titleId}
          value={title}
          onValueChange={onTitleChange}
          readOnly={locked}
          autoComplete="off"
          maxLength={300}
          placeholder={titlePlaceholder}
          aria-describedby={titleWarning ? warningId : undefined}
          className="-mx-1 w-[calc(100%+0.5rem)] min-w-0 rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground outline-none transition placeholder:text-subtle-foreground hover:border-border focus:border-brand/40 focus:bg-surface focus:ring-2 focus:ring-brand/15 sm:text-4xl"
        />
        {titleWarning && (
          <p id={warningId} className="mt-1.5 flex items-start gap-1.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{titleWarning}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {month && (
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor={monthId} className="text-sm font-medium text-muted-foreground">
                {t("editor.month")}
              </label>
              <select
                id={monthId}
                value={month.value}
                onChange={(e) => month.onChange(e.target.value)}
                disabled={locked}
                className="min-h-11 min-w-0 max-w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-1.5"
              >
                {month.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusView.tone}`}
          >
            <statusView.Icon
              className={`h-4 w-4 flex-none ${statusView.spin ? "animate-spin" : ""}`}
              aria-hidden
            />
            {statusView.text}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ProgramExportButton
            mode="inline"
            align="left"
            getDoc={getExportDoc}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            title={t("ed.saveShortcut")}
            aria-keyshortcuts="Control+S Meta+S"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-solid px-6 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("ed.save")}
          </button>
          <OverflowMenu label={menuLabel} items={menuItems} />
        </div>
      </div>
    </header>
  );
}
