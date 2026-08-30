"use client";

import { useState } from "react";
import type { FoodLibrary } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import {
  formatNutritionForDisplay,
  hasNutritionValues,
} from "@/lib/nutrition-math";
import { formatNutritionPortion } from "@/lib/nutrition-display";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 pr-16 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i");
}

/**
 * Searchable combobox over the food library. Typing filters the list AND sets a
 * free-text (custom) name; picking an item links the food_library entry (and
 * lets the caller prefill its default portion). Mirrors LibraryCombobox but
 * simpler — foods have no categories. Arrow-key nav, Enter to select, Escape.
 */
export default function FoodCombobox({
  items,
  value,
  linkedId,
  onPick,
  onType,
}: {
  items: FoodLibrary[];
  value: string;
  /** Library link for localized display; the stored snapshot remains English. */
  linkedId: string | null;
  onPick: (item: FoodLibrary) => void;
  onType: (name: string) => void;
}) {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const linkedFood = linkedId
    ? items.find((item) => item.id === linkedId) ?? null
    : null;
  const displayValue =
    linkedFood && lang === "tr" && linkedFood.name_tr?.trim()
      ? linkedFood.name_tr
      : value;
  const q = normalizeSearch(displayValue.trim());
  const matches = (
    q
      ? items.filter((item) =>
          normalizeSearch(
            [item.name, item.name_tr, item.default_portion]
              .filter(Boolean)
              .join(" "),
          ).includes(q),
        )
      : items
  ).slice(0, 40);
  const exact = items.some(
    (item) =>
      normalizeSearch(item.name) === q ||
      (item.name_tr ? normalizeSearch(item.name_tr) === q : false),
  );
  const showAddNew = q.length > 0 && !exact;
  const optionCount = matches.length + (showAddNew ? 1 : 0);

  function choose(idx: number) {
    if (showAddNew && idx === matches.length) {
      onType(value);
      setOpen(false);
      return;
    }
    const item = matches[idx];
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
        value={displayValue}
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
        placeholder={t("foodCombo.search")}
      />

      {linkedId && (
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
          <div className="max-h-72 space-y-0.5 overflow-auto">
            {matches.map((item, idx) => (
              <li key={item.id} className="list-none">
                <button
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
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {lang === "tr" && item.name_tr ? item.name_tr : item.name}
                    </span>
                    {item.name_tr && (
                      <span className="block truncate text-[11px] opacity-70">
                        {lang === "tr" ? item.name : item.name_tr}
                      </span>
                    )}
                  </span>
                  <span className="flex-none text-right">
                    {(item.serving_qty !== null && item.serving_unit) ||
                    item.default_portion ? (
                      <span
                        className={`block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          active === idx
                            ? "bg-brand/10 text-brand"
                            : "bg-pill text-subtle-foreground"
                        }`}
                      >
                        {item.serving_qty !== null && item.serving_unit
                          ? formatNutritionPortion(
                              item.serving_qty,
                              item.serving_unit,
                              lang,
                            )
                          : item.default_portion}
                      </span>
                    ) : null}
                    {hasNutritionValues(item) && item.kcal !== null && (
                      <span className="mt-1 block text-[10px] text-subtle-foreground">
                        {formatNutritionForDisplay("kcal", item.kcal, lang)}{" "}
                        {t("food.kcal")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </div>

          {showAddNew && (
            <li className="mt-1.5 list-none border-t border-border pt-1.5">
              <button
                type="button"
                onMouseEnter={() => setActive(matches.length)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(matches.length);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  active === matches.length
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
                  {t("foodCombo.addNew", { q: value.trim() })}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
