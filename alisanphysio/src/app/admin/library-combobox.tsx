"use client";

import { useState } from "react";
import type { ExerciseCategory, LibraryExercise } from "@/lib/types";
import { categoryLabel } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 pr-16 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

/**
 * Searchable combobox over the exercise library. Typing filters the list AND
 * sets a free-text (custom) name; picking an item links the library entry.
 * Results are grouped by category (an exercise tagged with several categories
 * appears under each). Supports arrow-key navigation, Enter to select, Escape.
 */
export default function LibraryCombobox({
  items,
  categories,
  value,
  linked,
  onPick,
  onType,
}: {
  items: LibraryExercise[];
  /** Pre-sorted (defaults first, then custom) — from loadLibrary(). */
  categories: ExerciseCategory[];
  value: string;
  /** true when the current name is linked to a library entry */
  linked: boolean;
  onPick: (item: LibraryExercise) => void;
  onType: (name: string) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = value.trim().toLowerCase();
  const matches = (
    q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items
  ).slice(0, 40);
  const exact = items.some((i) => i.name.toLowerCase() === q);
  const showAddNew = q.length > 0 && !exact;

  // Group matches by category (in the pre-sorted category order), then an
  // "Uncategorized" group. Flatten to `opts` so keyboard nav has a linear index.
  const groups: { key: string; label: string; items: LibraryExercise[]; start: number }[] = [];
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

  function choose(idx: number) {
    if (showAddNew && idx === opts.length) {
      onType(value); // keep the typed name as a custom exercise
      setOpen(false);
      return;
    }
    const item = opts[idx];
    if (item) {
      onPick(item);
      setOpen(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((a) => Math.min(a + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && optionCount > 0) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onType(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
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

      {open && optionCount > 0 && (
        <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lift">
          <div className="max-h-72 space-y-1 overflow-auto">
            {opts.length === 0 && (
              <p className="px-3 py-2 text-sm text-subtle-foreground">
                {t("combo.noMatches")}
              </p>
            )}

            {groups.map((g) => (
              <li key={g.key} className="list-none">
                <p className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">
                  {g.label}
                </p>
                <div className="space-y-0.5">
                  {g.items.map((item, i) => {
                    const idx = g.start + i;
                    return (
                      <button
                        key={`${g.key}:${item.id}`}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          choose(idx);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                          active === idx
                            ? "bg-brand-tint text-brand"
                            : "text-foreground hover:bg-pill"
                        }`}
                      >
                        <span className="truncate font-medium">{item.name}</span>
                        {item.youtube_url && (
                          <span
                            className={`flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              active === idx
                                ? "bg-brand/10 text-brand"
                                : "bg-brand-tint text-brand"
                            }`}
                          >
                            <span aria-hidden>▶</span> {t("combo.video")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </div>

          {showAddNew && (
            <li className="mt-1.5 list-none border-t border-border pt-1.5">
              <button
                type="button"
                onMouseEnter={() => setActive(opts.length)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(opts.length);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  active === opts.length
                    ? "bg-brand-tint text-brand"
                    : "text-muted-foreground hover:bg-pill"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-solid text-white"
                >
                  +
                </span>
                <span className="truncate">
                  {t("combo.addNew", { q: value.trim() })}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
