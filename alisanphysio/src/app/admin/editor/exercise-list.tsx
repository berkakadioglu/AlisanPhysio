"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ExerciseCategory, LibraryExercise } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import type { ExerciseDraft } from "./drafts";
import { duplicateFlags, mergeOrder, moveItem, restoreRemoved } from "./dose";
import { useSortable } from "./sortable";
import ExerciseRow, { type VideoAudience } from "./exercise-row";
import AddExerciseSearch from "./add-exercise-search";

/** Row key → play nonce (see ExerciseRow `playNonce`); absent = collapsed. */
type OpenRows = Record<string, number>;
const NONE_OPEN: OpenRows = {};

/**
 * The exercises of the selected day: one-line rows that expand into the full
 * editor, drag-and-drop / keyboard reordering, remove with Undo, and the
 * inline "Add exercise" library search at the bottom. Fully controlled by
 * `exercises` + `onChange`; only which rows are open is local, and that
 * resets whenever `resetKey` (the selected day) changes.
 */
export default function ExerciseList({
  exercises,
  onChange,
  library,
  categories,
  contentLang,
  resetKey,
  audience = "generic",
}: {
  exercises: ExerciseDraft[];
  onChange: (next: ExerciseDraft[]) => void;
  library: LibraryExercise[];
  categories: ExerciseCategory[];
  /** Language of the text the reps chips append (the programme's language). */
  contentLang: Lang;
  /** The selected day's key; open rows reset when it changes. */
  resetKey: string;
  /** Who a per-exercise video override is for: "client" in a client's
   *  programme ("…for this client"), "generic" in catalogue programmes and
   *  saved days ("…for this exercise"). Defaults to the neutral wording. */
  audience?: VideoAudience;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const hintId = `${useId()}-reorder-hint`;

  const libraryById = useMemo(() => new Map(library.map((item) => [item.id, item])), [library]);
  const duplicates = duplicateFlags(exercises);
  const inDayIds = useMemo(
    () => new Set(exercises.flatMap((e) => (e.library_id ? [e.library_id] : []))),
    [exercises],
  );

  // Open rows belong to one day; switching days starts with all collapsed.
  const [openState, setOpenState] = useState<{ day: string; rows: OpenRows }>({
    day: resetKey,
    rows: NONE_OPEN,
  });
  const openRows = openState.day === resetKey ? openState.rows : NONE_OPEN;
  const setOpen = (fn: (rows: OpenRows) => OpenRows) =>
    setOpenState((s) => ({ day: resetKey, rows: fn(s.day === resetKey ? s.rows : NONE_OPEN) }));

  const toggle = (key: string) =>
    setOpen((rows) => {
      const next = { ...rows };
      if (key in next) delete next[key];
      else next[key] = 0;
      return next;
    });
  /** Thumbnail click: open the row and (re)start its video. */
  const play = (key: string) => setOpen((rows) => ({ ...rows, [key]: (rows[key] ?? 0) + 1 }));
  const expand = (key: string) => setOpen((rows) => (key in rows ? rows : { ...rows, [key]: 0 }));

  // Polite announcements for reorders / adds (screen readers).
  const [announcement, setAnnouncement] = useState("");
  const announce = (message: string) =>
    // A trailing no-break space toggles so repeating the same text re-announces.
    setAnnouncement((prev) => (prev === message ? `${message} ` : message));

  // The latest props, for an Undo clicked after later edits (or another day).
  const latest = useRef({ exercises, onChange, resetKey, mounted: false });
  useEffect(() => {
    latest.current = { exercises, onChange, resetKey, mounted: true };
  });
  useEffect(
    () => () => {
      latest.current.mounted = false;
    },
    [],
  );

  const nameOf = (e: ExerciseDraft) => e.name.trim() || t("ed.row.untitled");

  // The day's row order including removed rows (see mergeOrder), so several
  // removals can be undone in any order and land back in their places.
  const order = useRef<{ day: string; keys: string[] }>({ day: resetKey, keys: [] });
  const rememberOrder = (day: string, keys: string[]) => {
    const memo = order.current.day === day ? order.current.keys : [];
    order.current = { day, keys: mergeOrder(memo, keys) };
    return order.current.keys;
  };

  function move(from: number, to: number) {
    const next = moveItem(exercises, from, to);
    if (next === exercises) return;
    onChange(next);
    announce(
      t("ed.row.moved", { name: nameOf(exercises[from]), pos: to + 1, total: exercises.length }),
    );
  }

  const { listRef, itemRef, itemStyle, handleProps, indicator, active, draggingKey } = useSortable({
    keys: exercises.map((e) => e.key),
    onMove: (from, to) => move(from, to),
  });

  const patch = (key: string, p: Partial<ExerciseDraft>) =>
    onChange(exercises.map((e) => (e.key === key ? { ...e, ...p } : e)));

  function remove(index: number) {
    const row = exercises[index];
    if (!row) return;
    const day = resetKey;
    // Remember where it was so Undo puts it back between the same rows, even
    // after other removals (or their Undos) in between.
    rememberOrder(day, exercises.map((e) => e.key));
    const at = {
      index,
      prevKey: exercises[index - 1]?.key ?? null,
      nextKey: exercises[index + 1]?.key ?? null,
    };
    onChange(exercises.filter((e) => e.key !== row.key));
    toast(t("ed.row.removed", { name: nameOf(row) }), {
      action: {
        label: t("ed.row.undo"),
        onClick: () => {
          const cur = latest.current;
          // Only restore into the same day the row came from.
          if (!cur.mounted || cur.resetKey !== day) {
            toast.error(t("ed.row.undoUnavailable"));
            return;
          }
          const memo = rememberOrder(day, cur.exercises.map((e) => e.key));
          const next = restoreRemoved(cur.exercises, row, at, memo);
          if (next !== cur.exercises) cur.onChange(next);
        },
      },
    });
  }

  function add(draft: ExerciseDraft, { custom }: { custom: boolean }) {
    onChange([...exercises, draft]);
    if (custom) expand(draft.key);
    announce(t("ed.add.added", { name: nameOf(draft) }));
  }

  return (
    <div className="@container min-w-0">
      <p id={hintId} className="sr-only">
        {t("ed.row.reorderHint")}
      </p>

      {exercises.length > 0 ? (
        <div className="relative">
          <ol
            ref={listRef}
            aria-label={t("ed.row.listLabel")}
            className="divide-y divide-border rounded-xl border border-border bg-surface"
          >
            {exercises.map((exercise, index) => (
              <ExerciseRow
                key={exercise.key}
                exercise={exercise}
                index={index}
                count={exercises.length}
                playNonce={openRows[exercise.key]}
                duplicate={duplicates[index]}
                linked={exercise.library_id ? libraryById.get(exercise.library_id) : undefined}
                library={library}
                categories={categories}
                contentLang={contentLang}
                audience={audience}
                reorderHintId={hintId}
                dragging={draggingKey === exercise.key}
                sorting={active}
                itemRef={itemRef(exercise.key)}
                style={itemStyle(index)}
                handleProps={handleProps(exercise.key, index)}
                onPatch={(p) => patch(exercise.key, p)}
                onToggle={() => toggle(exercise.key)}
                onPlay={() => play(exercise.key)}
                onMove={(direction) => move(index, index + direction)}
                onRemove={() => remove(index)}
              />
            ))}
          </ol>
          {indicator && (
            <div
              aria-hidden
              style={indicator}
              className="pointer-events-none absolute inset-x-0 z-10 rounded-xl border-2 border-dashed border-brand/50 bg-brand-tint/60"
            />
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {t("ed.row.empty")}
        </p>
      )}

      <AddExerciseSearch
        library={library}
        categories={categories}
        inDayIds={inDayIds}
        onAdd={add}
      />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
