"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ExerciseCategory,
  LibraryExercise,
  TemplateWithExercises,
} from "@/lib/types";
import { listWeekMondays } from "@/lib/program-dates";
import { weekLabel, weekTitle } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { saveProgram, deleteProgram } from "./actions";
import ExerciseRowsEditor, {
  IconBtn,
  blankRow,
  newKey,
  toRow,
  type Row,
} from "./exercise-rows-editor";
import TemplatePickerMenu from "./template-picker";
import ProgramExportButton, {
  type ExportDoc,
} from "@/components/program-export-button";

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

interface DayRow {
  key: string;
  title: string;
  rows: Row[];
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
  categories = [],
  templates = [],
  usedWeeks = [],
}: {
  clientId: string;
  programId?: string;
  initial: EditorInitial;
  library: LibraryExercise[];
  categories?: ExerciseCategory[];
  templates?: TemplateWithExercises[];
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
  // In-day "apply template" tried on a day that already has exercises → we warn
  // instead of overwriting, and offer to add it as a new day.
  const [applyWarn, setApplyWarn] = useState<
    { dayKey: string; tpl: TemplateWithExercises } | null
  >(null);

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

  // ---- day mutations ----
  const patchDay = (dayKey: string, fn: (d: DayRow) => DayRow) =>
    setDays((ds) => ds.map((d) => (d.key === dayKey ? fn(d) : d)));

  const addDay = () => setDays((ds) => [...ds, blankDay()]);

  /** "Add from template": append a NEW day that DEEP-COPIES the template's
   *  title + exercises into fresh, fully-editable rows. Editing them here never
   *  touches the original template (toRow builds new Row objects with new keys). */
  const addDayFromTemplate = (tpl: TemplateWithExercises) =>
    setDays((ds) => [
      ...ds,
      {
        key: newKey(),
        title: tpl.title,
        rows: tpl.exercises.length
          ? tpl.exercises.map(toRow)
          : [blankRow()],
      },
    ]);

  /** Apply a template to a SPECIFIC day (the in-day control). If the day is
   *  empty, fill it — deep-copy the template's exercises and, when the day's
   *  title is blank, adopt the template's title. If it already has exercises we
   *  never overwrite: show a warning that offers to add it as a new day. */
  const applyTemplateToDay = (dayKey: string, tpl: TemplateWithExercises) => {
    const day = days.find((d) => d.key === dayKey);
    const hasExercises = day?.rows.some((r) => r.name.trim() !== "");
    if (hasExercises) {
      setApplyWarn({ dayKey, tpl });
      return;
    }
    setApplyWarn((w) => (w?.dayKey === dayKey ? null : w));
    patchDay(dayKey, (d) => ({
      ...d,
      title: d.title.trim() === "" ? tpl.title : d.title,
      rows: tpl.exercises.length ? tpl.exercises.map(toRow) : [blankRow()],
    }));
  };
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

  // Snapshot the live editor state as a self-contained export document (works
  // for unsaved edits + brand-new programs — the server resolves video ids).
  const getExportDoc = (): ExportDoc => ({
    title: title.trim() || "Program",
    notes: notes.trim() || null,
    weekStart: weekStartDate || null,
    clientName: null,
    days: days.map((d) => ({
      title: d.title,
      exercises: d.rows.map((r) => ({
        name: r.name,
        sets: r.sets,
        reps: r.reps,
        instructions: r.instructions,
        media_url: r.media_url,
        library_id: r.library_id,
      })),
    })),
  });

  return (
    <>
      <Link
        href={`/admin/clients/${clientId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
      >
        <span aria-hidden>←</span> {t("editor.backToClient")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {isEdit ? t("editor.editHeading") : t("editor.newHeading")}
        </h1>
        <ProgramExportButton mode="inline" getDoc={getExportDoc} />
      </div>

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
            <ExerciseRowsEditor
              rows={day.rows}
              onRowsChange={(next) =>
                patchDay(day.key, (d) => ({ ...d, rows: next }))
              }
              library={library}
              categories={categories}
              templates={templates}
              onApplyTemplate={(tpl) => applyTemplateToDay(day.key, tpl)}
            />

            {applyWarn?.dayKey === day.key && (
              <div className="rounded-xl border border-warning/40 bg-[var(--warning-tint)] px-3.5 py-3">
                <p className="flex items-start gap-1.5 text-sm text-warning">
                  <span aria-hidden>⚠</span>
                  <span>{t("tpl.overwriteWarn")}</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      addDayFromTemplate(applyWarn.tpl);
                      setApplyWarn(null);
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-brand/40 hover:text-brand"
                  >
                    + {t("tpl.addAsNewDay")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyWarn(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
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

          {templates.length > 0 ? (
            <TemplatePickerMenu
              templates={templates}
              onPick={addDayFromTemplate}
              label={t("tpl.addDayFromTemplate")}
              buttonClassName="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
            />
          ) : (
            <p className="text-sm text-subtle-foreground">
              {t("tpl.noTemplatesHint")}{" "}
              <Link
                href="/admin/templates"
                className="font-medium text-brand transition hover:text-brand-hover"
              >
                {t("tpl.createOne")}
              </Link>
            </p>
          )}
        </div>
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

