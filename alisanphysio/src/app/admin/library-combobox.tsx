"use client";

import { useEffect, useId, useState } from "react";
import type { ExerciseCategory, LibraryExercise } from "@/lib/types";
import { categoryLabel } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { foldSearch } from "./editor/dose";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 pr-16 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

interface Group {
  key: string;
  label: string;
  items: LibraryExercise[];
  start: number;
}

/**
 * Searchable combobox over the exercise library (ARIA combobox + grouped
 * listbox). Typing filters the list AND sets a free-text (custom) name;
 * picking an item links the library entry. Results are grouped by category
 * (an exercise tagged with several categories appears under each). Arrow keys
 * move the highlighted option (announced via aria-activedescendant), Enter
 * picks it, Escape closes. An option is only pre-highlighted when it matches
 * the typed text exactly or as a prefix, so Enter never silently swaps a
 * typed custom name for a loosely matching entry.
 */
export default function LibraryCombobox({
  items,
  categories,
  value,
  linked,
  onPick,
  onType,
  id,
  ariaLabel,
}: {
  items: LibraryExercise[];
  /** Pre-sorted (defaults first, then custom) — from loadLibrary(). */
  categories: ExerciseCategory[];
  value: string;
  /** true when the current name is linked to a library entry */
  linked: boolean;
  onPick: (item: LibraryExercise) => void;
  onType: (name: string) => void;
  /** Optional input id (for an external <label htmlFor>). */
  id?: string;
  ariaLabel?: string;
}) {
  const { t, lang } = useI18n();
  const uid = useId();
  const listId = `${id ?? uid}-list`;
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const [open, setOpen] = useState(false);
  /** The highlighted option; null = automatic (exact / prefix match, else none). */
  const [active, setActive] = useState<number | null>(null);

  const folded = items.map((i) => foldSearch(i.name));
  const q = foldSearch(value);
  const trimmed = value.trim();
  const exact = q !== "" && folded.includes(q);
  const showAddNew = q !== "" && !exact;

  // Group matches by category (in the pre-sorted category order), then an
  // "Uncategorized" group. Flatten to `opts` so keyboard nav has a linear index.
  const matches = (q ? items.filter((_, i) => folded[i].includes(q)) : items).slice(0, 40);
  const groups: Group[] = [];
  const opts: LibraryExercise[] = [];
  for (const cat of categories) {
    const its = matches.filter((m) => m.category_ids.includes(cat.id));
    if (its.length === 0) continue;
    groups.push({ key: cat.id, label: categoryLabel(lang, cat), items: its, start: opts.length });
    opts.push(...its);
  }
  const uncategorized = matches.filter((m) => m.category_ids.length === 0);
  if (uncategorized.length > 0) {
    groups.push({ key: "__none", label: t("cat.none"), items: uncategorized, start: opts.length });
    opts.push(...uncategorized);
  }

  const optionCount = opts.length + (showAddNew ? 1 : 0);
  const expanded = open && optionCount > 0;

  // Pre-highlight only an exact match, else the first prefix match, else nothing.
  const optNames = opts.map((o) => foldSearch(o.name));
  const exactAt = q ? optNames.indexOf(q) : -1;
  const autoIndex = !q ? -1 : exactAt >= 0 ? exactAt : optNames.findIndex((n) => n.startsWith(q));
  const activeIndex = Math.min(active ?? autoIndex, optionCount - 1);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!expanded || activeIndex < 0) return;
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, activeIndex, listId]);

  // Opening or closing the list always drops a manual highlight, so the
  // exact / prefix rule decides afresh (a stale index from an earlier pick
  // would otherwise point at a different, non-matching option).
  function openList() {
    setActive(null);
    setOpen(true);
  }
  function closeList() {
    setActive(null);
    setOpen(false);
  }

  function choose(idx: number) {
    if (showAddNew && idx === opts.length) {
      onType(value); // keep the typed name as a custom exercise
      closeList();
      return;
    }
    const item = opts[idx];
    if (item) {
      onPick(item);
      closeList();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActive(Math.min(activeIndex + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (expanded) {
        e.preventDefault();
        // Nothing highlighted: keep the typed text as is.
        if (activeIndex >= 0) choose(activeIndex);
        else closeList();
      }
    } else if (e.key === "Escape") {
      if (open) e.preventDefault();
      closeList();
    }
  }

  const optionClass = (idx: number, idle: string) =>
    `flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
      activeIndex === idx ? "bg-brand-tint text-brand" : idle
    }`;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onType(e.target.value);
          openList();
        }}
        onFocus={openList}
        onBlur={() => setTimeout(closeList, 120)}
        onKeyDown={onKeyDown}
        className={inputClass}
        placeholder={t("combo.search")}
      />

      {linked && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand"
          title={t("combo.linked")}
        >
          {t("combo.linked")}
        </span>
      )}

      <div
        id={listId}
        role="listbox"
        aria-label={ariaLabel ?? t("combo.search")}
        hidden={!expanded}
        className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lift"
      >
        {expanded && (
          <>
            <div className="max-h-72 space-y-1 overflow-auto">
              {opts.length === 0 && (
                <p className="px-3 py-2 text-sm text-subtle-foreground">{t("combo.noMatches")}</p>
              )}

              {groups.map((g) => (
                <div key={g.key} role="group" aria-labelledby={`${listId}-grp-${g.key}`}>
                  <div
                    id={`${listId}-grp-${g.key}`}
                    className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground"
                  >
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((item, i) => {
                      const idx = g.start + i;
                      return (
                        <div
                          key={`${g.key}:${item.id}`}
                          id={optionId(idx)}
                          role="option"
                          aria-selected={activeIndex === idx}
                          onMouseEnter={() => setActive(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault(); // keep focus in the field
                            choose(idx);
                          }}
                          className={`${optionClass(idx, "text-foreground hover:bg-pill")} justify-between`}
                        >
                          <span className="truncate font-medium">{item.name}</span>
                          {item.youtube_url && (
                            <span
                              className={`flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                activeIndex === idx ? "bg-brand/10 text-brand" : "bg-brand-tint text-brand"
                              }`}
                            >
                              <span aria-hidden>▶</span> {t("combo.video")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {showAddNew && (
              <div className="mt-1.5 border-t border-border pt-1.5">
                <div
                  id={optionId(opts.length)}
                  role="option"
                  aria-selected={activeIndex === opts.length}
                  onMouseEnter={() => setActive(opts.length)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(opts.length);
                  }}
                  className={`${optionClass(opts.length, "text-muted-foreground hover:bg-pill")} font-medium`}
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-solid text-white"
                  >
                    +
                  </span>
                  <span className="truncate">{t("combo.addNew", { q: trimmed })}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
