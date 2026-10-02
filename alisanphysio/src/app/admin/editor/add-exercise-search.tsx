"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Plus, Search } from "lucide-react";
import type { ExerciseCategory, LibraryExercise } from "@/lib/types";
import { categoryLabel } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { toExerciseDraft, type ExerciseDraft } from "./drafts";
import { foldSearch } from "./dose";

interface Group {
  key: string;
  label: string;
  items: LibraryExercise[];
  start: number;
}

/**
 * The "Add exercise" field under a day's rows: ONE inline search over the
 * library (ARIA combobox + grouped listbox, arrow keys / Enter / Escape).
 * Picking an entry appends a new row linked to it (cues pre-filled from the
 * library's default instructions) and clears the field for the next one; the
 * last option adds the typed name as a custom (unlinked) exercise.
 */
export default function AddExerciseSearch({
  library,
  categories,
  inDayIds,
  onAdd,
}: {
  library: LibraryExercise[];
  categories: ExerciseCategory[];
  /** Library ids already used in this day (shown as a hint, not blocked). */
  inDayIds: ReadonlySet<string>;
  onAdd: (draft: ExerciseDraft, options: { custom: boolean }) => void;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const folded = useMemo(() => library.map((item) => foldSearch(item.name)), [library]);
  const q = foldSearch(query);
  const trimmed = query.trim();

  // Group the matches by category (pre-sorted order), then "Uncategorized";
  // `options` is the flat order keyboard navigation walks.
  const { groups, options } = useMemo(() => {
    const matches = q ? library.filter((_, i) => folded[i].includes(q)) : library;
    const groups: Group[] = [];
    const options: LibraryExercise[] = [];
    for (const cat of categories) {
      const items = matches.filter((m) => m.category_ids.includes(cat.id));
      if (items.length === 0) continue;
      groups.push({ key: cat.id, label: categoryLabel(lang, cat), items, start: options.length });
      options.push(...items);
    }
    const none = matches.filter((m) => m.category_ids.length === 0);
    if (none.length > 0) {
      groups.push({ key: "__none", label: t("cat.none"), items: none, start: options.length });
      options.push(...none);
    }
    return { groups, options };
  }, [library, folded, categories, q, lang, t]);

  const showCustom = trimmed !== "" && !folded.includes(q);
  const optionCount = options.length + (showCustom ? 1 : 0);
  const expanded = open && optionCount > 0;
  const activeIndex = Math.min(active, Math.max(0, optionCount - 1));

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!expanded) return;
    document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, activeIndex, id]);

  function reset() {
    setQuery("");
    setActive(0);
    setOpen(false);
  }

  function choose(index: number) {
    if (showCustom && index === options.length) {
      onAdd(
        toExerciseDraft({
          name: trimmed,
          sets: null,
          reps: "",
          instructions: "",
          media_url: null,
          library_id: null,
        }),
        { custom: true },
      );
      reset();
      return;
    }
    const item = options[index];
    if (!item) return;
    onAdd(
      toExerciseDraft({
        name: item.name,
        sets: null,
        reps: "",
        instructions: item.default_instructions ?? "",
        media_url: null,
        library_id: item.id,
      }),
      { custom: false },
    );
    reset();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive(Math.min(activeIndex + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Home" && expanded) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && expanded) {
      e.preventDefault();
      setActive(optionCount - 1);
    } else if (e.key === "Enter") {
      // Never let Enter submit a surrounding form from this field.
      e.preventDefault();
      if (expanded) choose(activeIndex);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (query) {
        e.preventDefault();
        setQuery("");
      }
    }
  }

  const optionClass = (index: number) =>
    `flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition sm:min-h-10 ${
      activeIndex === index ? "bg-brand-tint text-brand" : "text-foreground hover:bg-pill"
    }`;

  return (
    <div className="relative mt-3">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground"
        aria-hidden
      />
      <input
        type="text"
        role="combobox"
        aria-label={t("ed.add.label")}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={t("ed.add.placeholder")}
        className="h-12 w-full rounded-xl border border-dashed border-border bg-surface pl-10 pr-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground hover:border-brand/40 focus:border-solid focus:border-brand/40 focus:ring-2 focus:ring-brand/15 sm:text-sm"
      />

      <div
        id={listId}
        role="listbox"
        aria-label={t("ed.add.label")}
        hidden={!expanded}
        className="absolute inset-x-0 z-30 mt-1.5 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-1.5 shadow-lift"
      >
        {expanded && (
          <>
            {options.length === 0 && (
              <p className="px-3 py-2 text-sm text-subtle-foreground">{t("ed.add.noMatches")}</p>
            )}

            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`${id}-grp-${g.key}`} className="pb-1">
                <div
                  id={`${id}-grp-${g.key}`}
                  className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground"
                >
                  {g.label}
                </div>
                {g.items.map((item, i) => {
                  const index = g.start + i;
                  return (
                    <div
                      key={`${g.key}:${item.id}`}
                      id={optionId(index)}
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep focus in the field
                        choose(index);
                      }}
                      className={optionClass(index)}
                    >
                      <span className="min-w-0 truncate font-medium">{item.name}</span>
                      <span className="flex flex-none items-center gap-1.5">
                        {inDayIds.has(item.id) && (
                          <span className="hidden text-[11px] font-medium text-warning min-[400px]:inline">
                            {t("ed.add.inDay")}
                          </span>
                        )}
                        {item.youtube_url && (
                          <span className="flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand">
                            <span aria-hidden>▶</span> {t("combo.video")}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {showCustom && (
              <div className={options.length > 0 ? "mt-1 border-t border-border pt-1.5" : ""}>
                <div
                  id={optionId(options.length)}
                  role="option"
                  aria-selected={activeIndex === options.length}
                  onMouseEnter={() => setActive(options.length)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(options.length);
                  }}
                  className={`${optionClass(options.length)} justify-start font-medium`}
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-solid text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 truncate">{t("ed.add.custom", { q: trimmed })}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
