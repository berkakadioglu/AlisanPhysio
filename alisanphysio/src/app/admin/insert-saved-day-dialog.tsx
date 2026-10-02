"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, ExternalLink, RotateCw, Search } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import { exercisesCount, setsEffort } from "@/lib/i18n";
import type { EditorDay } from "@/lib/program-editor-model";
import { richTextExcerpt } from "@/lib/rich-text";
import { savedDayNameKey, savedDayToEditorDay } from "@/lib/saved-days";
import type { DayTemplateExercise, TemplateWithExercises } from "@/lib/types";
import { SavedDayModal, SavedDayModalHeader } from "./save-day-dialog";

/**
 * "Insert saved day": a searchable list of saved days and the full exercise
 * list of the selected one. "Add as Day N" hands the editor a deep COPY
 * (`savedDayToEditorDay`); the editor appends it as the new last day, selects
 * it and shows the Undo toast. Existing days are never touched.
 * `loadFailed` (from loadSavedDaysForEditor's `savedDaysFailed`): the saved
 * days could not be loaded, so an empty list says so and offers a retry
 * instead of claiming there are no saved days yet.
 */
export default function InsertSavedDayDialog(props: {
  open: boolean;
  onClose: () => void;
  savedDays: TemplateWithExercises[];
  nextDayNumber: number;
  onInsert: (day: EditorDay, savedDay: TemplateWithExercises) => void;
  loadFailed?: boolean;
}) {
  if (!props.open) return null;
  // Mounted per opening: search and selection start fresh every time.
  return <InsertPanel {...props} />;
}

function dose(lang: "en" | "tr", e: Pick<DayTemplateExercise, "sets" | "reps">): string {
  if (e.sets !== null && e.sets !== undefined) return setsEffort(lang, e.sets, e.reps);
  return e.reps?.trim() ?? "";
}

function InsertPanel({
  onClose,
  savedDays,
  nextDayNumber,
  onInsert,
  loadFailed = false,
}: {
  onClose: () => void;
  savedDays: TemplateWithExercises[];
  nextDayNumber: number;
  onInsert: (day: EditorDay, savedDay: TemplateWithExercises) => void;
  loadFailed?: boolean;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const titleId = useId();
  const subtitleId = useId();
  const searchId = useId();
  const listName = useId();
  const detailId = useId();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const live = savedDays.filter((d) => !d.deleted_at);
  const key = savedDayNameKey(query);
  const visible = key
    ? live.filter((d) => savedDayNameKey(`${d.title} ${d.source_label ?? ""}`).includes(key))
    : live;
  const selected = visible.find((d) => d.id === selectedId) ?? null;
  const exercises = selected
    ? [...selected.exercises].sort((a, b) => a.order_index - b.order_index)
    : [];

  function insert() {
    if (!selected) return;
    onInsert(savedDayToEditorDay(selected), selected);
    onClose();
  }

  return (
    <SavedDayModal
      labelledBy={titleId}
      describedBy={subtitleId}
      onClose={onClose}
      className="flex max-w-4xl flex-col md:overflow-hidden"
    >
      <div className="flex-none p-5 pb-0 sm:p-7 sm:pb-0">
        <SavedDayModalHeader
          titleId={titleId}
          subtitleId={subtitleId}
          title={t("sd.insertTitle")}
          subtitle={t("sd.insertSubtitle")}
          icon={<CalendarPlus className="h-5 w-5" />}
          onClose={onClose}
        />
      </div>

      {live.length === 0 && loadFailed ? (
        <div role="alert" className="m-5 rounded-2xl bg-danger-tint px-5 py-8 text-center sm:m-7">
          <p className="mx-auto flex max-w-md items-start justify-center gap-2.5 text-sm leading-relaxed text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <span>{t("sd.loadFailed")}</span>
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            {t("sd.tryAgain")}
          </button>
        </div>
      ) : live.length === 0 ? (
        <div className="m-5 rounded-2xl border border-dashed border-border px-5 py-10 text-center sm:m-7">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{t("sd.insertEmpty")}</p>
          <Link
            href="/admin/programs?tab=saved-days"
            target="_blank"
            rel="noopener"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {t("sd.goToSavedDays")}
            <ExternalLink className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("sd.newTab")}</span>
          </Link>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 p-5 sm:p-7 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
          {/* Left: search + list */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <label htmlFor={searchId} className="sr-only">{t("sd.search")}</label>
            <div className="flex flex-none items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/40">
              <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
              <input
                id={searchId}
                data-autofocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("sd.search")}
                autoComplete="off"
                className="min-h-11 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
              />
            </div>
            {visible.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t("sd.noMatches")}
              </p>
            ) : (
              <fieldset className="mt-3 min-h-0 min-w-0 flex-1 md:overflow-y-auto md:pr-1">
                <legend className="sr-only">{t("sd.heading")}</legend>
                <ul className="max-h-72 space-y-2 overflow-y-auto md:max-h-none md:overflow-visible">
                  {visible.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-pill has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40">
                        <input
                          type="radio"
                          name={listName}
                          value={d.id}
                          checked={selected?.id === d.id}
                          onChange={() => setSelectedId(d.id)}
                          aria-controls={detailId}
                          className="mt-1 h-4 w-4 flex-none accent-[var(--brand-solid)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-foreground [overflow-wrap:anywhere]">{d.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {exercisesCount(lang, d.exercises.length)}
                            {" · "}
                            {d.source_label ? t("sd.fromSource", { source: d.source_label }) : t("sd.createdHere")}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </div>

          {/* Right: the selected saved day's full exercise list */}
          <section
            id={detailId}
            aria-live="polite"
            aria-label={selected?.title ?? t("sd.selectHint")}
            className="min-h-0 min-w-0 rounded-xl border border-border bg-background p-4 md:overflow-y-auto"
          >
            {!selected ? (
              <p className="flex h-full min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
                {t("sd.selectHint")}
              </p>
            ) : (
              <>
                <h3 className="font-display text-lg font-bold text-foreground [overflow-wrap:anywhere]">{selected.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {exercisesCount(lang, exercises.length)}
                  {" · "}
                  {selected.source_label ? t("sd.fromSource", { source: selected.source_label }) : t("sd.createdHere")}
                </p>
                {exercises.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">{t("sd.noExercises")}</p>
                ) : (
                  <ol className="mt-4 divide-y divide-border">
                    {exercises.map((e, i) => {
                      const effort = dose(lang, e);
                      const cues = richTextExcerpt(e.instructions, 140);
                      return (
                        <li key={e.id} className="flex min-w-0 gap-3 py-2.5 first:pt-0 last:pb-0">
                          <span className="w-6 flex-none pt-0.5 text-right text-xs font-semibold tabular-nums text-subtle-foreground">
                            {i + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{e.name}</p>
                            {effort && <p className="text-xs font-medium text-brand [overflow-wrap:anywhere]">{effort}</p>}
                            {cues && <p className="mt-0.5 truncate text-xs text-muted-foreground">{cues}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <div className="flex flex-none flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end sm:px-7">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {t("common.cancel")}
        </button>
        {live.length > 0 && (
          <button
            type="button"
            onClick={insert}
            disabled={!selected}
            className="min-h-11 rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sd.addAsDay", { n: nextDayNumber })}
          </button>
        )}
      </div>
    </SavedDayModal>
  );
}
