"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExerciseLibrary } from "@/lib/types";
import { listWeekMondays } from "@/lib/program-dates";
import { weekLabel, weekTitle } from "@/lib/i18n";
import { parseYouTubeId } from "@/lib/youtube";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import YouTubeEmbed from "@/components/youtube-embed";
import { saveProgram, deleteProgram } from "./actions";
import LibraryCombobox from "./library-combobox";

export interface EditorExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
}

export interface EditorDay {
  title: string;
  exercises: EditorExercise[];
}

export interface EditorInitial {
  title: string;
  weekStartDate: string;
  notes: string;
  days: EditorDay[];
}

interface Row {
  key: string;
  name: string;
  sets: string;
  reps: string;
  instructions: string;
  media_url: string;
  library_id: string | null;
  saveToLibrary: boolean;
}

interface DayRow {
  key: string;
  title: string;
  rows: Row[];
}

let keySeq = 0;
const newKey = () => `k-${keySeq++}`;

function toRow(e: EditorExercise): Row {
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

function blankRow(): Row {
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

function blankDay(): DayRow {
  return { key: newKey(), title: "", rows: [blankRow()] };
}

function toDays(initial: EditorDay[]): DayRow[] {
  if (!initial.length) return [blankDay()];
  return initial.map((d) => ({
    key: newKey(),
    title: d.title,
    rows: d.exercises.length ? d.exercises.map(toRow) : [blankRow()],
  }));
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function ProgramEditor({
  clientId,
  programId,
  initial,
  library,
  usedWeeks = [],
}: {
  clientId: string;
  programId?: string;
  initial: EditorInitial;
  library: ExerciseLibrary[];
  usedWeeks?: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useI18n();
  const isEdit = Boolean(programId);

  const [title, setTitle] = useState(initial.title);
  const [weekStartDate, setWeekStartDate] = useState(initial.weekStartDate);
  const [notes, setNotes] = useState(initial.notes);
  const [days, setDays] = useState<DayRow[]>(toDays(initial.days));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const libraryById = useMemo(
    () => new Map(library.map((i) => [i.id, i])),
    [library],
  );

  // Week dropdown options: a few weeks back to ~8 ahead, plus the current one
  // (in case we're editing an older program outside that window).
  const weekOptions = useMemo(() => {
    const set = new Set(listWeekMondays(3, 8));
    if (weekStartDate) set.add(weekStartDate);
    return [...set].sort();
  }, [weekStartDate]);
  const usedSet = useMemo(() => new Set(usedWeeks), [usedWeeks]);

  function selectWeek(monday: string) {
    setWeekStartDate(monday);
    setTitle(weekTitle(monday, lang));
  }

  /** Part A: a row is a duplicate if the same library entry or name already
   *  appears earlier in the SAME day (across days is fine). Non-blocking. */
  function isDuplicateRow(day: DayRow, index: number): boolean {
    const row = day.rows[index];
    const key = row.library_id
      ? `lib:${row.library_id}`
      : row.name.trim()
        ? `name:${row.name.trim().toLowerCase()}`
        : null;
    if (!key) return false;
    for (let i = 0; i < index; i++) {
      const other = day.rows[i];
      const okey = other.library_id
        ? `lib:${other.library_id}`
        : other.name.trim()
          ? `name:${other.name.trim().toLowerCase()}`
          : null;
      if (okey === key) return true;
    }
    return false;
  }

  // ---- day + row mutations ----
  const patchDay = (dayKey: string, fn: (d: DayRow) => DayRow) =>
    setDays((ds) => ds.map((d) => (d.key === dayKey ? fn(d) : d)));

  const addDay = () => setDays((ds) => [...ds, blankDay()]);
  const removeDay = (dayKey: string) =>
    setDays((ds) => {
      const target = ds.find((d) => d.key === dayKey);
      const hasNamed = target?.rows.some((r) => r.name.trim() !== "");
      if (hasNamed && !confirm(t("editor.confirmDeleteDay"))) {
        return ds;
      }
      const next = ds.filter((d) => d.key !== dayKey);
      return next.length ? next : [blankDay()];
    });
  const setDayTitle = (dayKey: string, title: string) =>
    patchDay(dayKey, (d) => ({ ...d, title }));
  const moveDay = (index: number, dir: -1 | 1) =>
    setDays((ds) => {
      const next = [...ds];
      const j = index + dir;
      if (j < 0 || j >= next.length) return ds;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const addRow = (dayKey: string) =>
    patchDay(dayKey, (d) => ({ ...d, rows: [...d.rows, blankRow()] }));
  const removeRow = (dayKey: string, rowKey: string) =>
    patchDay(dayKey, (d) => ({
      ...d,
      rows: d.rows.length > 1 ? d.rows.filter((r) => r.key !== rowKey) : d.rows,
    }));
  const updateRow = (dayKey: string, rowKey: string, patch: Partial<Row>) =>
    patchDay(dayKey, (d) => ({
      ...d,
      rows: d.rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)),
    }));
  const pickLibrary = (dayKey: string, rowKey: string, item: ExerciseLibrary) =>
    patchDay(dayKey, (d) => ({
      ...d,
      rows: d.rows.map((r) =>
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
    }));
  const typeName = (dayKey: string, rowKey: string, name: string) =>
    updateRow(dayKey, rowKey, { name, library_id: null });
  const moveRow = (dayKey: string, index: number, dir: -1 | 1) =>
    patchDay(dayKey, (d) => {
      const next = [...d.rows];
      const j = index + dir;
      if (j < 0 || j >= next.length) return d;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...d, rows: next };
    });

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await saveProgram({
      id: programId,
      clientId,
      title,
      weekStartDate,
      notes,
      days: days.map((d) => ({
        title: d.title,
        exercises: d.rows.map((r) => ({
          name: r.name,
          sets: r.sets.trim() === "" ? null : Number(r.sets),
          reps: r.reps,
          instructions: r.instructions,
          media_url: r.media_url,
          library_id: r.library_id,
          saveToLibrary: r.saveToLibrary && !r.library_id,
        })),
      })),
    });
    if (res.ok) {
      toast(t("toast.programSaved"));
      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!programId) return;
    if (!confirm(t("editor.confirmDeleteProgram"))) return;
    setSaving(true);
    const res = await deleteProgram({ programId, clientId });
    if (res.ok) {
      toast(t("toast.programDeleted"));
      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  // ---- render a single exercise row ----
  function renderRow(day: DayRow, row: Row, i: number) {
    const libItem = row.library_id ? libraryById.get(row.library_id) : undefined;
    const videoId = parseYouTubeId(libItem?.youtube_url ?? row.media_url);
    const duplicate = isDuplicateRow(day, i);

    return (
      <li key={row.key} className="rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold text-muted-foreground">
            {i + 1}
          </span>
          <div className="flex items-center gap-1">
            <IconBtn label={t("editor.moveUp")} disabled={i === 0} onClick={() => moveRow(day.key, i, -1)}>
              ↑
            </IconBtn>
            <IconBtn
              label={t("editor.moveDown")}
              disabled={i === day.rows.length - 1}
              onClick={() => moveRow(day.key, i, 1)}
            >
              ↓
            </IconBtn>
            <IconBtn
              label={t("editor.remove")}
              disabled={day.rows.length === 1}
              onClick={() => removeRow(day.key, row.key)}
            >
              ✕
            </IconBtn>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <LibraryCombobox
            items={library}
            value={row.name}
            linked={Boolean(row.library_id)}
            onPick={(item) => pickLibrary(day.key, row.key, item)}
            onType={(name) => typeName(day.key, row.key, name)}
          />

          {/* Part A: soft, non-blocking duplicate-in-day warning. */}
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
                  onChange={(e) =>
                    updateRow(day.key, row.key, { saveToLibrary: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand/30"
                />
                {t("editor.saveToLibrary")}
              </label>
            )
          )}

          {/* Inline video preview so Alişan can confirm the movement. */}
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
                updateRow(day.key, row.key, {
                  sets: e.target.value.replace(/[^0-9]/g, ""),
                })
              }
              className={inputClass}
              placeholder={t("editor.sets")}
            />
            <input
              value={row.reps}
              onChange={(e) => updateRow(day.key, row.key, { reps: e.target.value })}
              className={inputClass}
              placeholder={t("editor.reps")}
            />
          </div>

          <input
            value={row.instructions}
            onChange={(e) =>
              updateRow(day.key, row.key, { instructions: e.target.value })
            }
            className={inputClass}
            placeholder={t("editor.instructions")}
          />

          <input
            value={row.media_url}
            onChange={(e) => updateRow(day.key, row.key, { media_url: e.target.value })}
            autoComplete="off"
            className={inputClass}
            placeholder={
              row.library_id ? t("editor.videoOverride") : t("editor.mediaUrl")
            }
          />
        </div>
      </li>
    );
  }

  function renderRows(day: DayRow) {
    return (
      <>
        <ol className="space-y-3">
          {day.rows.map((row, i) => renderRow(day, row, i))}
        </ol>
        <button
          type="button"
          onClick={() => addRow(day.key)}
          className="mt-3 w-full rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-brand/40 hover:text-brand"
        >
          + {t("editor.addExercise")}
        </button>
      </>
    );
  }

  return (
    <>
      <Link
        href={`/admin/clients/${clientId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
      >
        <span aria-hidden>←</span> {t("editor.backToClient")}
      </Link>

      <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
        {isEdit ? t("editor.editHeading") : t("editor.newHeading")}
      </h1>

      {/* Program fields */}
      <div className="mt-8 space-y-5 rounded-2xl bg-surface p-5 shadow-soft sm:p-6">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t("editor.week")}
          </label>
          <select
            value={weekStartDate}
            onChange={(e) => selectWeek(e.target.value)}
            className={`${inputClass} max-w-md`}
          >
            {weekOptions.map((m) => (
              <option key={m} value={m}>
                {weekLabel(m, lang)}
                {usedSet.has(m) && m !== weekStartDate
                  ? ` ${t("editor.hasProgram")}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t("editor.title")}{" "}
            <span className="text-subtle-foreground">{t("editor.titleHint")}</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            className={inputClass}
            placeholder={t("editor.titlePlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t("editor.notes")}{" "}
            <span className="text-subtle-foreground">{t("common.optional")}</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder={t("editor.notesPlaceholder")}
          />
        </div>
      </div>

      {/* Days — a single unnamed day renders as a plain flat list for the client */}
      <div className="mt-8 space-y-5">
        {days.map((day, di) => (
          <div
            key={day.key}
            className="space-y-4 rounded-2xl border border-border p-4 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <span className="flex-none rounded-full bg-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("editor.dayLabel", { n: di + 1 })}
              </span>
              <input
                value={day.title}
                onChange={(e) => setDayTitle(day.key, e.target.value)}
                autoComplete="off"
                className={`${inputClass} flex-1 font-medium`}
                placeholder={t("editor.dayPlaceholder")}
              />
              <IconBtn label={t("editor.moveDayUp")} disabled={di === 0} onClick={() => moveDay(di, -1)}>
                ↑
              </IconBtn>
              <IconBtn
                label={t("editor.moveDayDown")}
                disabled={di === days.length - 1}
                onClick={() => moveDay(di, 1)}
              >
                ↓
              </IconBtn>
              {days.length > 1 && (
                <IconBtn label={t("editor.deleteDay")} onClick={() => removeDay(day.key)}>
                  ✕
                </IconBtn>
              )}
            </div>
            {renderRows(day)}
          </div>
        ))}

        <button
          type="button"
          onClick={addDay}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>{" "}
          {t("editor.addDay")}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("editor.saveProgram")}
          </button>
          <Link
            href={`/admin/clients/${clientId}`}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
          >
            {t("common.cancel")}
          </Link>
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger-tint disabled:opacity-60"
          >
            {t("editor.deleteProgram")}
          </button>
        )}
      </div>
    </>
  );
}

function IconBtn({
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
