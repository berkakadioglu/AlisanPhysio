"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, CopyPlus, RefreshCw, Trash2 } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import type { DayDraft } from "./drafts";
import OverflowMenu from "./overflow-menu";
import TitleField from "./title-field";

/**
 * The selected day's header: a large inline-editable (wrapping) title, the day actions
 * (save as template, update the saved day it came from, duplicate, ⋯ move / delete)
 * and — for a day inserted from a saved day — a quiet origin line explaining that
 * edits stay local.
 */
export default function DayHeader({
  day,
  dayNumber,
  dayCount,
  onTitleChange,
  onSaveAsTemplate,
  updateTargetName,
  onUpdateSavedDay,
  onDuplicate,
  onMove,
  onDelete,
}: {
  day: DayDraft;
  dayNumber: number;
  dayCount: number;
  onTitleChange: (title: string) => void;
  onSaveAsTemplate: () => void;
  /** Name of the live saved day this day came from; with `onUpdateSavedDay`, offers the update. */
  updateTargetName?: string | null;
  onUpdateSavedDay?: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const inputId = useId();

  const actionClass =
    "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

  // Layout (one wrapping flex row; DOM order = reading / tab order):
  // - narrow (<sm): "DAY N" · full-width title · origin line · actions row.
  // - sm+: "DAY N" with the actions on the right of the SAME top row, then the
  //   full-width title (it wraps over several lines, never squeezed beside the
  //   buttons) and the full-width origin line under it.
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label
        htmlFor={inputId}
        className="order-1 min-w-0 px-1 text-xs font-semibold uppercase tracking-widest text-brand"
      >
        {t("editor.dayLabel", { n: dayNumber })}
        <span className="sr-only"> — {t("ed.day.titleLabel")}</span>
      </label>

      <TitleField
        id={inputId}
        data-day-title
        value={day.title}
        onValueChange={onTitleChange}
        autoComplete="off"
        maxLength={200}
        placeholder={t("ed.day.titlePlaceholder", { n: dayNumber })}
        className="order-2 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1 py-1 font-display text-2xl font-bold leading-tight tracking-tight text-foreground outline-none transition placeholder:font-semibold placeholder:text-subtle-foreground hover:border-border focus:border-brand/40 focus:bg-surface focus:ring-2 focus:ring-brand/15 sm:order-3 sm:text-[1.7rem]"
      />

      {day.sourceTemplateLabel && (
        <p className="order-3 w-full min-w-0 px-1 text-xs text-subtle-foreground [overflow-wrap:anywhere] sm:order-4">
          {t("ed.day.origin", { name: day.sourceTemplateLabel })}
        </p>
      )}

      {/* grid-flow-dense: the update button takes its own full row on narrow
          screens, and Duplicate and ⋯ move back up beside Save. */}
      <div className="order-4 grid w-full grid-flow-dense grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 pt-1 sm:order-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:pt-0">
        <button type="button" onClick={onSaveAsTemplate} className={`${actionClass} text-left`}>
          <BookmarkPlus className="h-4 w-4 flex-none" aria-hidden />
          {t("ed.day.saveAsTemplate")}
        </button>
        {updateTargetName && onUpdateSavedDay && (
          <button
            type="button"
            onClick={onUpdateSavedDay}
            aria-label={t("sd.updateLabel", { name: updateTargetName })}
            className={`${actionClass} col-span-3 justify-center sm:col-span-1`}
          >
            <RefreshCw className="h-4 w-4 flex-none" aria-hidden />
            {t("sd.update")}
          </button>
        )}
        <button type="button" onClick={onDuplicate} className={actionClass}>
          <CopyPlus className="h-4 w-4 flex-none" aria-hidden />
          {t("ed.day.duplicate")}
        </button>
        <OverflowMenu
          label={t("ed.day.more")}
          items={[
            {
              label: t("ed.day.moveEarlier"),
              Icon: ArrowUp,
              disabled: dayNumber === 1,
              onSelect: () => onMove(-1),
            },
            {
              label: t("ed.day.moveLater"),
              Icon: ArrowDown,
              disabled: dayNumber === dayCount,
              onSelect: () => onMove(1),
            },
            { label: t("editor.deleteDay"), Icon: Trash2, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  );
}
