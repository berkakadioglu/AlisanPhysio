"use client";

import type {
  ExerciseCategory,
  LibraryExercise,
  TemplateWithExercises,
} from "@/lib/types";
import { parseYouTubeId } from "@/lib/youtube";
import { useI18n } from "@/app/i18n-provider";
import YouTubeEmbed from "@/components/youtube-embed";
import LibraryCombobox from "./library-combobox";
import TemplatePickerMenu from "./template-picker";

/** One editable exercise row (string-based fields for controlled inputs). */
export interface Row {
  key: string;
  name: string;
  sets: string;
  reps: string;
  instructions: string;
  media_url: string;
  library_id: string | null;
  saveToLibrary: boolean;
}

/** The saved shape a row is seeded from (program day / template exercise). */
export interface RowSeed {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
}

let keySeq = 0;
export const newKey = () => `k-${keySeq++}`;

export function toRow(e: RowSeed): Row {
  return {
    key: newKey(),
    name: e.name,
    sets: e.sets == null ? "" : String(e.sets),
    reps: e.reps ?? "",
    instructions: e.instructions ?? "",
    media_url: e.media_url ?? "",
    library_id: e.library_id,
    saveToLibrary: false,
  };
}

export function blankRow(): Row {
  return {
    key: newKey(),
    name: "",
    sets: "",
    reps: "",
    instructions: "",
    media_url: "",
    library_id: null,
    saveToLibrary: false,
  };
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

/**
 * The exercise list for a single "day": the category-grouped library combobox
 * per row (pick → fills name/link/prefills instructions, or add-new), sets /
 * reps / instructions / media, an inline video preview, a non-blocking
 * duplicate-in-day warning, and add / remove / reorder. Shared by the program
 * editor and the day-template editor via a controlled `rows` + `onRowsChange`.
 */
export default function ExerciseRowsEditor({
  rows,
  onRowsChange,
  library,
  categories,
  templates,
  onApplyTemplate,
}: {
  rows: Row[];
  onRowsChange: (rows: Row[]) => void;
  library: LibraryExercise[];
  categories: ExerciseCategory[];
  /** When provided (program editor), an in-day "Add from template" control sits
   *  next to "+ Add exercise" and applies the picked template to THIS day. */
  templates?: TemplateWithExercises[];
  onApplyTemplate?: (tpl: TemplateWithExercises) => void;
}) {
  const { t } = useI18n();
  const libraryById = new Map(library.map((i) => [i.id, i]));

  const update = (rowKey: string, patch: Partial<Row>) =>
    onRowsChange(rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)));
  const add = () => onRowsChange([...rows, blankRow()]);
  const remove = (rowKey: string) =>
    onRowsChange(rows.length > 1 ? rows.filter((r) => r.key !== rowKey) : rows);
  const move = (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onRowsChange(next);
  };
  const pick = (rowKey: string, item: LibraryExercise) =>
    onRowsChange(
      rows.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              name: item.name,
              library_id: item.id,
              saveToLibrary: false,
              instructions:
                r.instructions.trim() || item.default_instructions || "",
            }
          : r,
      ),
    );
  const typeName = (rowKey: string, name: string) =>
    update(rowKey, { name, library_id: null });

  /** A row duplicates an earlier one in this day if it links the same library
   *  entry or shares the (trimmed, lowercased) name. Non-blocking. */
  function isDuplicate(index: number): boolean {
    const row = rows[index];
    const key = row.library_id
      ? `lib:${row.library_id}`
      : row.name.trim()
        ? `name:${row.name.trim().toLowerCase()}`
        : null;
    if (!key) return false;
    for (let i = 0; i < index; i++) {
      const other = rows[i];
      const okey = other.library_id
        ? `lib:${other.library_id}`
        : other.name.trim()
          ? `name:${other.name.trim().toLowerCase()}`
          : null;
      if (okey === key) return true;
    }
    return false;
  }

  function renderRow(row: Row, i: number) {
    const libItem = row.library_id ? libraryById.get(row.library_id) : undefined;
    const videoId = parseYouTubeId(libItem?.youtube_url ?? row.media_url);
    const duplicate = isDuplicate(i);

    return (
      <li key={row.key} className="rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold text-muted-foreground">
            {i + 1}
          </span>
          <div className="flex items-center gap-1">
            <IconBtn label={t("editor.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </IconBtn>
            <IconBtn
              label={t("editor.moveDown")}
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </IconBtn>
            <IconBtn
              label={t("editor.remove")}
              disabled={rows.length === 1}
              onClick={() => remove(row.key)}
            >
              ✕
            </IconBtn>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <LibraryCombobox
            items={library}
            categories={categories}
            value={row.name}
            linked={Boolean(row.library_id)}
            onPick={(item) => pick(row.key, item)}
            onType={(name) => typeName(row.key, name)}
          />

          {duplicate && (
            <p className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-warning">
              <span aria-hidden>⚠</span>
              {t("editor.alreadyInDay")}
            </p>
          )}

          {row.library_id ? (
            <p className="px-0.5 text-xs text-subtle-foreground">
              {t("editor.linkedNote")}
            </p>
          ) : (
            row.name.trim() !== "" && (
              <label className="flex cursor-pointer items-center gap-2 px-0.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.saveToLibrary}
                  onChange={(e) => update(row.key, { saveToLibrary: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand/30"
                />
                {t("editor.saveToLibrary")}
              </label>
            )
          )}

          {videoId && (
            <div className="max-w-[260px] overflow-hidden rounded-xl">
              <YouTubeEmbed id={videoId} title={row.name || "Preview"} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <input
              inputMode="numeric"
              value={row.sets}
              onChange={(e) =>
                update(row.key, { sets: e.target.value.replace(/[^0-9]/g, "") })
              }
              className={inputClass}
              placeholder={t("editor.sets")}
            />
            <input
              value={row.reps}
              onChange={(e) => update(row.key, { reps: e.target.value })}
              className={inputClass}
              placeholder={t("editor.reps")}
            />
          </div>

          <input
            value={row.instructions}
            onChange={(e) => update(row.key, { instructions: e.target.value })}
            className={inputClass}
            placeholder={t("editor.instructions")}
          />

          <input
            value={row.media_url}
            onChange={(e) => update(row.key, { media_url: e.target.value })}
            autoComplete="off"
            className={inputClass}
            placeholder={row.library_id ? t("editor.videoOverride") : t("editor.mediaUrl")}
          />
        </div>
      </li>
    );
  }

  const dashedBtn =
    "rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-brand/40 hover:text-brand";
  const showTemplateControl =
    onApplyTemplate && templates && templates.length > 0;

  return (
    <>
      <ol className="space-y-3">{rows.map((row, i) => renderRow(row, i))}</ol>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={add} className={`flex-1 ${dashedBtn}`}>
          + {t("editor.addExercise")}
        </button>
        {showTemplateControl && (
          <TemplatePickerMenu
            templates={templates}
            onPick={onApplyTemplate}
            label={t("tpl.addFromTemplate")}
            align="right"
            buttonClassName={`inline-flex w-full items-center justify-center gap-1.5 sm:w-auto ${dashedBtn}`}
          />
        )}
      </div>
    </>
  );
}

export function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
