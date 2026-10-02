"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { exercisesCount } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import type { DayDraft } from "./drafts";
import { namedExercises } from "./day-ops";

/**
 * DOM id of a day's tab — the day panel is labelled by it. Index-based on
 * purpose: draft keys come from a module counter that differs between the
 * server render and the browser, so they must never reach DOM attributes.
 */
export const dayTabId = (index: number) => `program-editor-day-tab-${index}`;

/** Tailwind lg: the rail is a vertical list from here up. */
const LG_QUERY = "(min-width: 1024px)";

function subscribeLg(onChange: () => void) {
  const mq = window.matchMedia(LG_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Whether the rail is laid out vertically (lg+). The server render assumes the narrow strip. */
function useIsVertical() {
  return useSyncExternalStore(
    subscribeLg,
    () => window.matchMedia(LG_QUERY).matches,
    () => false,
  );
}

/**
 * The training-day rail. Desktop (lg+): a vertical list beside the selected
 * day. Narrow screens: a horizontal scrolling strip above it (the strip
 * scrolls, the page never does). It is a tab list — one tab stop, arrow keys /
 * Home / End move between days and select them.
 */
export default function DayRail({
  days,
  selectedKey,
  panelId,
  onSelect,
  onAddDay,
  onInsertSaved,
  canInsertSaved,
  savedDaysHref,
}: {
  days: DayDraft[];
  selectedKey: string;
  /** id of the day panel the tabs control. */
  panelId: string;
  onSelect: (key: string) => void;
  onAddDay: () => void;
  onInsertSaved: () => void;
  canInsertSaved: boolean;
  /** "Go to Saved days" — covered by the editor's leave guard like every link. */
  savedDaysHref: string;
}) {
  const { t, lang } = useI18n();
  const vertical = useIsVertical();

  function focusTab(index: number) {
    const day = days[index];
    if (!day) return;
    onSelect(day.key);
    const el = document.getElementById(dayTabId(index));
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const index = days.findIndex((d) => d.key === selectedKey);
    const map: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: days.length - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    focusTab(Math.max(0, Math.min(days.length - 1, map[e.key])));
  }

  const actionClass =
    "inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="hidden px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:block">
        {t("ed.rail.label")}
      </p>
      <div
        role="tablist"
        aria-label={t("ed.rail.label")}
        aria-orientation={vertical ? "vertical" : "horizontal"}
        onKeyDown={onKeyDown}
        className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:thin] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {days.map((day, i) => {
          const selected = day.key === selectedKey;
          const count = namedExercises(day.exercises).length;
          return (
            <button
              key={day.key}
              id={dayTabId(i)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(day.key)}
              className={`flex w-44 flex-none flex-col items-start gap-0.5 rounded-xl px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 lg:w-full ${
                selected
                  ? "bg-brand-tint ring-1 ring-brand/40"
                  : "bg-surface shadow-soft hover:bg-pill"
              }`}
            >
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  selected ? "text-brand" : "text-muted-foreground"
                }`}
              >
                {t("editor.dayLabel", { n: i + 1 })}
              </span>
              <span
                className={`line-clamp-2 w-full text-sm font-semibold [overflow-wrap:anywhere] lg:line-clamp-none ${
                  day.title.trim() ? "text-foreground" : "italic text-subtle-foreground"
                }`}
              >
                {day.title.trim() || t("ed.rail.untitled")}
              </span>
              <span className="text-xs text-muted-foreground">{exercisesCount(lang, count)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 lg:flex-col">
        <button type="button" onClick={onAddDay} className={actionClass}>
          <Plus className="h-4 w-4 flex-none" aria-hidden />
          {t("ed.rail.newDay")}
        </button>
        <button
          type="button"
          onClick={onInsertSaved}
          disabled={!canInsertSaved}
          aria-describedby={canInsertSaved ? undefined : `${panelId}-no-saved`}
          className={actionClass}
        >
          <Library className="h-4 w-4 flex-none" aria-hidden />
          {t("ed.rail.insertSaved")}
        </button>
      </div>
      {!canInsertSaved && (
        <p id={`${panelId}-no-saved`} className="px-1 text-xs text-subtle-foreground">
          {t("ed.rail.noSavedDays")}{" "}
          <Link
            href={savedDaysHref}
            className="font-medium text-brand underline-offset-2 transition hover:underline"
          >
            {t("ed.rail.openSavedDays")}
          </Link>
        </p>
      )}
    </div>
  );
}
