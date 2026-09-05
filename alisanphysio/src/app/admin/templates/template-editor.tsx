"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExerciseCategory, LibraryExercise } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import ExerciseRowsEditor, {
  blankRow,
  toRow,
  type Row,
  type RowSeed,
} from "../exercise-rows-editor";
import { deleteTemplate, saveTemplate } from "../template-actions";
import ProgramExportButton, {
  type ExportDoc,
} from "@/components/program-export-button";

export interface TemplateInitial {
  id?: string;
  title: string;
  exercises: RowSeed[];
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function TemplateEditor({
  initial,
  library,
  categories,
}: {
  initial: TemplateInitial;
  library: LibraryExercise[];
  categories: ExerciseCategory[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const isEdit = Boolean(initial.id);

  const [title, setTitle] = useState(initial.title);
  const [rows, setRows] = useState<Row[]>(
    initial.exercises.length ? initial.exercises.map(toRow) : [blankRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The template's live state as a one-section export document.
  const getExportDoc = (): ExportDoc => ({
    title: title.trim() || "Template",
    notes: null,
    monthStart: null,
    clientName: null,
    days: [
      {
        title: "",
        exercises: rows.map((r) => ({
          name: r.name,
          sets: r.sets,
          reps: r.reps,
          instructions: r.instructions,
          media_url: r.media_url,
          library_id: r.library_id,
        })),
      },
    ],
  });

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await saveTemplate({
      id: initial.id,
      title,
      exercises: rows.map((r) => ({
        name: r.name,
        sets: r.sets.trim() === "" ? null : Number(r.sets),
        reps: r.reps,
        instructions: r.instructions,
        media_url: r.media_url,
        library_id: r.library_id,
        saveToLibrary: r.saveToLibrary && !r.library_id,
      })),
    });
    if (res.ok) {
      toast(t("toast.templateSaved"));
      router.push("/admin/templates");
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial.id) return;
    if (!confirm(t("tpl.confirmDelete"))) return;
    setSaving(true);
    const res = await deleteTemplate({ id: initial.id });
    if (res.ok) {
      toast(t("toast.templateDeleted"));
      router.push("/admin/templates");
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        href="/admin/templates"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
      >
        <span aria-hidden>←</span> {t("tpl.backToList")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {isEdit ? t("tpl.editHeading") : t("tpl.newHeading")}
        </h1>
        <ProgramExportButton mode="inline" getDoc={getExportDoc} />
      </div>

      <div className="mt-8 space-y-1.5 rounded-2xl bg-surface p-5 shadow-soft sm:p-6">
        <label className="block text-sm font-medium text-foreground">
          {t("tpl.titleLabel")}
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          className={inputClass}
          placeholder={t("tpl.titlePlaceholder")}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("tpl.exercisesHeading")}
        </h2>
        <ExerciseRowsEditor
          rows={rows}
          onRowsChange={setRows}
          library={library}
          categories={categories}
        />
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
            {saving ? t("common.saving") : t("tpl.save")}
          </button>
          <Link
            href="/admin/templates"
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
            {t("tpl.delete")}
          </button>
        )}
      </div>
    </>
  );
}
