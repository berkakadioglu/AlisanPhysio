"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookmarkPlus, X } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { exercisesCount, formatDay } from "@/lib/i18n";
import { localToday } from "@/lib/month";
import type { EditorDay } from "@/lib/program-editor-model";
import {
  SAVED_DAY_TITLE_MAX,
  findSavedDayConflict,
  nextCopyName,
  savableExercises,
  saveDayChoiceFor,
  type SaveDayChoice,
} from "@/lib/saved-days";
import type { TemplateWithExercises } from "@/lib/types";
import { saveDayAsTemplate, undoSaveDayAsTemplate } from "./template-actions";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.closest("[hidden]") && el.getClientRects().length > 0,
  );
}

/**
 * The modal shell shared by the saved-day dialogs: scrim + panel, focus moved
 * into the dialog (an element marked `data-autofocus`, else the first control)
 * and trapped there, Escape and a backdrop click close it, focus returns to the
 * opener on close, and the page behind does not scroll.
 */
export function SavedDayModal({
  labelledBy,
  describedBy,
  onClose,
  className = "max-w-lg",
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(panel)[0] ?? panel;
    target.focus();

    function onKey(e: KeyboardEvent) {
      if (!panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`w-full min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-surface text-foreground shadow-lift outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/** The dialog header: title, optional subtitle and a close button. */
export function SavedDayModalHeader({
  titleId,
  subtitleId,
  title,
  subtitle,
  icon,
  onClose,
}: {
  titleId: string;
  subtitleId?: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-tint text-brand" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="font-display text-xl font-bold leading-tight text-foreground [overflow-wrap:anywhere]">
          {title}
        </h2>
        {subtitle && (
          <p id={subtitleId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("sd.close")}
        title={t("sd.close")}
        className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-xl text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

const PREVIEW_COUNT = 5;

type SaveDayProps = {
  open: boolean;
  onClose: () => void;
  day: EditorDay;
  dayNumber: number;
  sourceLabel: string | null;
  savedDays: TemplateWithExercises[];
  /**
   * The programme day this save comes from (its programme and position), when
   * it can be linked: the programme is saved and has no unsaved edits. Null
   * otherwise. The link is only used to offer "Update saved day".
   */
  link: { programId: string; dayIndex: number } | null;
  /** The saved day was saved (or replaced one); `linked` = the day was linked to it. */
  onSaved?: (result: { templateId: string; replacedId: string | null; linked: boolean }) => void;
  /** The save was undone; `linked` = the programme day's link was changed back. */
  onUndone?: (result: { templateId: string; previousTemplateId: string | null; linked: boolean }) => void;
};

/**
 * "Save day as template": saves a COPY of a programme day as a saved day.
 * Name prefilled from the day title, the exercises that will be saved, an
 * empty-day block, and the same-name choice (new copy — the default, auto-named
 * — or replace, which moves the current version to Recently deleted). After
 * saving, a toast offers Undo for 10 seconds.
 */
export default function SaveDayDialog(props: SaveDayProps) {
  if (!props.open) return null;
  // Mounted per opening, so the form always starts from the current day.
  return <SaveDayPanel {...props} />;
}

function SaveDayPanel({
  onClose,
  day,
  dayNumber,
  sourceLabel,
  savedDays,
  link,
  onSaved,
  onUndone,
}: Omit<SaveDayProps, "open">) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const titleId = useId();
  const subtitleId = useId();
  const nameId = useId();
  const hintId = useId();

  const exercises = useMemo(() => savableExercises(day.exercises), [day]);
  const [name, setName] = useState(() =>
    (day.title.trim() || t("sd.dayN", { n: dayNumber })).slice(0, SAVED_DAY_TITLE_MAX),
  );
  const [rawChoice, setRawChoice] = useState<SaveDayChoice>({ mode: "copy", forId: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim().replace(/\s+/gu, " ");
  const empty = exercises.length === 0;
  const conflict = findSavedDayConflict(trimmed, savedDays);
  // A different conflicting saved day (or none) resets the choice to "copy",
  // so Replace is never carried over to a saved day it was not picked for.
  const current = saveDayChoiceFor(rawChoice, conflict?.id);
  if (current !== rawChoice) setRawChoice(current);
  const choice = current.mode;
  const setChoice = (mode: SaveDayChoice["mode"]) => setRawChoice({ mode, forId: conflict?.id ?? null });
  const copyName = conflict
    ? nextCopyName(trimmed, savedDays.filter((d) => !d.deleted_at).map((d) => d.title), SAVED_DAY_TITLE_MAX)
    : null;
  const canSave = !empty && trimmed !== "" && !busy;

  async function undo(templateId: string, replacedId: string | null, linked: boolean) {
    // The day's saved-day id before this save (the Undo puts it back).
    const previousTemplateId = day.sourceTemplateId ?? null;
    try {
      const res = await undoSaveDayAsTemplate({
        templateId,
        restoreId: replacedId,
        link: linked && link ? { ...link, previousTemplateId } : null,
      });
      if (res.ok) {
        toast(t("sd.saveUndone"));
        onUndone?.({ templateId, previousTemplateId, linked });
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error(t("sd.undoError"));
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveDayAsTemplate({
        title: trimmed,
        exercises,
        sourceLabel,
        replaceId: conflict && choice === "replace" ? conflict.id : null,
        link,
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      onClose();
      onSaved?.({ templateId: res.templateId, replacedId: res.replacedId, linked: res.linked });
      toast(t("sd.savedToast", { title: res.title }), {
        action: { label: t("sd.undo"), onClick: () => void undo(res.templateId, res.replacedId, res.linked) },
      });
      router.refresh();
    } catch {
      setError(t("sd.saveError"));
      setBusy(false);
    }
  }

  const radio =
    "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-pill has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40";

  return (
    <SavedDayModal labelledBy={titleId} describedBy={subtitleId} onClose={onClose}>
      <form onSubmit={submit} className="p-5 sm:p-7">
        <SavedDayModalHeader
          titleId={titleId}
          subtitleId={subtitleId}
          title={t("sd.saveTitle")}
          subtitle={t("sd.saveSubtitle")}
          icon={<BookmarkPlus className="h-5 w-5" />}
          onClose={onClose}
        />

        {empty ? (
          <p
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl bg-[var(--warning-tint)] p-4 text-sm leading-relaxed text-foreground"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden />
            {t("sd.emptyDay")}
          </p>
        ) : (
          <>
            <label htmlFor={nameId} className="mt-6 block text-sm font-semibold text-foreground">
              {t("sd.nameLabel")}
            </label>
            <input
              id={nameId}
              data-autofocus
              type="text"
              value={name}
              maxLength={SAVED_DAY_TITLE_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-describedby={hintId}
              aria-invalid={trimmed === "" || undefined}
              autoComplete="off"
              className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-subtle-foreground focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
            />

            <div id={hintId} className="mt-5">
              <p className="text-sm font-semibold text-foreground">
                {t("sd.willSave", { count: exercisesCount(lang, exercises.length) })}
              </p>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                {exercises.slice(0, PREVIEW_COUNT).map((ex, i) => (
                  <li key={i} className="flex min-w-0 gap-2">
                    <span className="w-5 flex-none text-right tabular-nums text-subtle-foreground">{i + 1}.</span>
                    <span className="min-w-0 truncate">{ex.name}</span>
                  </li>
                ))}
              </ol>
              {exercises.length > PREVIEW_COUNT && (
                <p className="mt-1 pl-7 text-sm text-subtle-foreground">
                  {t("sd.andMore", { count: exercises.length - PREVIEW_COUNT })}
                </p>
              )}
            </div>

            {conflict && copyName && (
              <div className="mt-5 rounded-xl border border-border bg-background p-4">
                <p role="status" className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden />
                  <span>
                    {t("sd.conflict", {
                      name: conflict.title,
                      count: exercisesCount(lang, conflict.exercises.length),
                      date: formatDay(localToday(new Date(conflict.updated_at)), lang),
                    })}
                  </span>
                </p>
                <fieldset className="mt-3 min-w-0 space-y-2">
                  <legend className="sr-only">{t("sd.conflictLegend")}</legend>
                  <label className={radio}>
                    <input
                      type="radio"
                      name="save-mode"
                      checked={choice === "copy"}
                      onChange={() => setChoice("copy")}
                      className="mt-1 h-4 w-4 flex-none accent-[var(--brand-solid)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{t("sd.saveAsCopy")}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {t("sd.copyNamed", { name: copyName })}
                      </span>
                    </span>
                  </label>
                  <label className={radio}>
                    <input
                      type="radio"
                      name="save-mode"
                      checked={choice === "replace"}
                      onChange={() => setChoice("replace")}
                      className="mt-1 h-4 w-4 flex-none accent-[var(--brand-solid)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{t("sd.replaceExisting")}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{t("sd.replaceHint")}</span>
                    </span>
                  </label>
                </fieldset>
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="min-h-11 rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("sd.saving") : t("sd.saveButton")}
          </button>
        </div>
      </form>
    </SavedDayModal>
  );
}
