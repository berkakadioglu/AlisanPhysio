"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
import type {
  ExerciseCategory,
  LibraryExercise,
  TemplateWithExercises,
} from "@/lib/types";
import type { EditorDay, EditorInitial } from "@/lib/program-editor-model";
import { listMonthStarts } from "@/lib/month";
import { exercisesCount, monthLabel, monthTitle, type Lang } from "@/lib/i18n";
import { findSavedDayNameChangeConflict, savedDaySourceLabel } from "@/lib/saved-days";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import type { ExportDoc } from "@/components/program-export-button";
import { saveProgram, deleteProgram } from "./actions";
import { deleteCatalogProgram } from "./programs/actions";
import { deleteSavedDay, restoreSavedDay, saveTemplate } from "./template-actions";
import SaveDayDialog from "./save-day-dialog";
import InsertSavedDayDialog from "./insert-saved-day-dialog";
import UpdateSavedDayDialog from "./update-saved-day-dialog";
import ExerciseList from "./editor/exercise-list";
import { fromDayDraft, toDayDraft, type DayDraft, type ExerciseDraft } from "./editor/drafts";
import {
  appendDay,
  duplicateDay,
  editorSnapshot,
  firstUnnamedExercise,
  hasNamedExercises,
  initialDays,
  moveDay,
  namedExercises,
  patchDay,
  removeDay,
  savedDayIndex,
  toExportDays,
  toSaveDays,
  toSaveExercises,
} from "./editor/day-ops";
import { formatSavedTime, useLeaveGuard, useSaveShortcut } from "./editor/use-dirty";
import EditorHeader, { type SaveStatus } from "./editor/editor-header";
import NotesPanel from "./editor/notes-panel";
import DayRail, { dayTabId } from "./editor/day-rail";
import DayHeader from "./editor/day-header";
import type { OverflowMenuItem } from "./editor/overflow-menu";

export type { EditorDay, EditorExercise, EditorInitial } from "@/lib/program-editor-model";

export type ProgramEditorProps = {
  mode: "client" | "catalog" | "template";
  /** Client / catalogue programme being edited (absent = new). */
  programId?: string;
  /** Saved day being edited (mode "template"; absent = new). */
  templateId?: string;
  clientId: string | null;
  /** Back link label, PDF "for <name>", save-day source label. */
  clientName?: string | null;
  /** Language of the text the reps chips insert (the client's language). */
  contentLang?: Lang;
  timeZone?: string | null;
  /** Template mode: one day; `initial.title` is the saved day's name. */
  initial: EditorInitial;
  library: LibraryExercise[];
  categories: ExerciseCategory[];
  /** Live saved days (insert dialog + name conflicts). */
  savedDays?: TemplateWithExercises[];
  /** The saved days could not be loaded (the insert dialog says so instead of "none yet"). */
  savedDaysFailed?: boolean;
  usedMonths?: string[];
  /**
   * 0-based day to show first (the edit pages pass `?day=N`, so the first
   * save of a new programme lands back on the day the coach was on).
   */
  initialDayIndex?: number;
};

const SAVED_DAYS_HREF = "/admin/programs?tab=saved-days";
const DAY_PANEL_ID = "program-editor-day";
const DAY_TITLE_INPUT = "[data-day-title]";

/**
 * The ONE editor for client programmes, catalogue programmes and saved days.
 * Header (title, month, save status, PDF, Save, ⋯) → programme notes → a day
 * rail beside the selected day (rows inside are <ExerciseList>). Saving stays
 * on the page; a brand-new programme / saved day moves to its edit URL after
 * the first save. Template mode is the same shell with a single day: no rail,
 * no notes, the page title is the saved day's name.
 */
export default function ProgramEditor({
  mode,
  programId,
  templateId,
  clientId,
  clientName = null,
  contentLang,
  timeZone,
  initial,
  library,
  categories,
  savedDays = [],
  savedDaysFailed = false,
  usedMonths = [],
  initialDayIndex = 0,
}: ProgramEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useI18n();
  const isTemplate = mode === "template";

  // The saved row's id. Starts from the props and is set by the first save of
  // a new programme / saved day, so a second save never creates a duplicate.
  const [currentId, setCurrentId] = useState(isTemplate ? templateId : programId);
  const [title, setTitle] = useState(initial.title);
  const [monthStartDate, setMonthStartDate] = useState(initial.monthStartDate);
  const [notes, setNotes] = useState(initial.notes);
  const [days, setDays] = useState<DayDraft[]>(() => initialDays(initial.days));
  // null = the first day (a removed key also falls back to the first day).
  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => days[initialDayIndex]?.key ?? null,
  );
  const [saving, setSaving] = useState(false);
  // The first save of a NEW programme / saved day navigates to its edit URL,
  // which mounts a fresh editor. From the click until then the editor is
  // locked (inert), so nothing can be typed into the instance that is about to
  // be replaced. (Saves of an existing record never lock: the editor stays.)
  const [firstSaveLock, setFirstSaveLock] = useState(false);
  // The same, for toast Undo closures (rendered outside the inert regions and
  // holding stale state): they must not change the instance being replaced —
  // that edit would never be saved, and it would re-arm the leave guard.
  const lockedRef = useRef(false);
  const lock = (on: boolean) => {
    lockedRef.current = on;
    setFirstSaveLock(on);
  };
  const saveInProgressError = () => toast.error(t("ed.error.stillSaving"));
  // A transition, so the old editor stays rendered (and locked) until the
  // edit page is ready.
  const [, startNav] = useTransition();
  // Undo closures (toasts) can outlive this editor instance.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    editorSnapshot({ ...initial, days: initialDays(initial.days) }),
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveDayKey, setSaveDayKey] = useState<string | null>(null);
  const [updateDayKey, setUpdateDayKey] = useState<string | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);

  const selectedIndex = Math.max(0, days.findIndex((d) => d.key === selectedKey));
  const selectedDay = days[selectedIndex];

  // "Update saved day": the live saved day a day came from (deleted ones and
  // ones that no longer exist are not offered). The day whose update dialog is
  // open keeps its key while the dialog is open.
  const savedDayById = (id: string | null) =>
    id ? savedDays.find((d) => d.id === id && !d.deleted_at) : undefined;
  const updateTarget = savedDayById(selectedDay.sourceTemplateId);
  const updateDay = updateDayKey ? days.find((d) => d.key === updateDayKey) : undefined;
  const updateDayTarget = savedDayById(updateDay?.sourceTemplateId ?? null);
  const updateDayCopy = useMemo(() => (updateDay ? fromDayDraft(updateDay) : null), [updateDay]);
  const updateOpen = Boolean(updateDayCopy && updateDayTarget);

  const snapshot = useMemo(
    () => editorSnapshot({ title, monthStartDate, notes, days }),
    [title, monthStartDate, notes, days],
  );
  const dirty = snapshot !== savedSnapshot;
  // The latest state for the save dialog's callbacks (they can run after the
  // render that created them, e.g. an Undo toast).
  const latest = useRef({ days, title, monthStartDate, notes, snapshot, savedSnapshot });
  useEffect(() => {
    latest.current = { days, title, monthStartDate, notes, snapshot, savedSnapshot };
  });
  // Covers tab close / reload, every same-origin link (header nav, back link…)
  // and the browser Back button. `releaseGuard()` before navigating ourselves.
  // Suspended during the first save: nothing may push a guard entry at the
  // "new" URL that the edit URL then lands on top of.
  const releaseGuard = useLeaveGuard(dirty, t("ed.leaveConfirm"), firstSaveLock);
  // Not while a dialog is open (Ctrl+S there must not save the whole editor).
  useSaveShortcut(() => {
    if (!saveDayKey && !insertOpen && !updateOpen) void onSave();
  });

  /** Guard for programmatic navigation (router.push) away from unsaved changes. */
  const confirmLeave = () => !dirty || confirm(t("ed.leaveConfirm"));

  const backHref =
    mode === "client" && clientId
      ? `/admin/clients/${clientId}`
      : mode === "catalog"
        ? "/admin/programs"
        : SAVED_DAYS_HREF;
  const backLabel =
    mode === "client"
      ? clientName?.trim() || t("editor.backToClient")
      : mode === "catalog"
        ? t("ed.back.catalogue")
        : t("ed.back.savedDays");

  // Month options include the original date and a few months either side
  // (in case we're editing an older program outside that window).
  const monthOptions = useMemo(() => {
    const set = new Set(listMonthStarts(3, 8, new Date(), timeZone));
    if (monthStartDate) set.add(monthStartDate);
    return [...set].sort();
  }, [monthStartDate, timeZone]);
  const usedSet = useMemo(() => new Set(usedMonths), [usedMonths]);

  function selectMonth(month: string) {
    setMonthStartDate(month);
    setTitle(monthTitle(month, lang));
  }

  // ---- day mutations ----
  const setDayExercises = (key: string, exercises: ExerciseDraft[]) => {
    // While locked the list is inert, so this can only be a row's toast Undo.
    if (lockedRef.current) return saveInProgressError();
    setDays((ds) => patchDay(ds, key, { exercises }));
  };

  function addDay() {
    const next = appendDay(days);
    setDays(next.days);
    setSelectedKey(next.key);
    // Name the new day straight away (after React has rendered it).
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(DAY_TITLE_INPUT)?.focus(),
    );
  }

  function onDuplicateDay() {
    const next = duplicateDay(days, selectedDay.key);
    setDays(next.days);
    if (next.key) setSelectedKey(next.key);
  }

  function onDeleteDay() {
    if (hasNamedExercises(selectedDay) && !confirm(t("editor.confirmDeleteDay"))) return;
    const next = removeDay(days, selectedDay.key);
    setDays(next.days);
    setSelectedKey(next.selectedKey);
  }

  /** A saved day always lands as a NEW last day; Undo removes exactly it. */
  function onInsertSavedDay(day: EditorDay, savedDay: TemplateWithExercises) {
    const previousKey = selectedDay.key;
    const draft = toDayDraft(day);
    const dayNumber = days.length + 1;
    setDays((ds) => appendDay(ds, draft).days);
    setSelectedKey(draft.key);
    toast(t("ed.toast.inserted", { name: savedDay.title, n: dayNumber }), {
      action: {
        label: t("ed.undo"),
        onClick: () => {
          // The first save of a new programme remounts the editor: this
          // instance's state is gone, so say so instead of silently no-op'ing.
          if (!mounted.current) {
            toast.error(t("ed.error.undoAfterReload"));
            return;
          }
          if (lockedRef.current) return saveInProgressError();
          setDays((ds) => removeDay(ds, draft.key).days);
          setSelectedKey(previousKey);
        },
      },
    });
  }

  // ---- save / delete ----
  /** Returns true when the editor is moving to the new record's edit URL. */
  async function afterSave(
    id: string,
    sentSnapshot: string,
    editHref: string,
    message: string,
  ): Promise<boolean> {
    const wasNew = !currentId;
    setCurrentId(id);
    setSavedSnapshot(sentSnapshot);
    setSavedAt(formatSavedTime(new Date(), lang));
    toast(message);
    // Pop the leave guard's history entry first, so the refresh / replace
    // below applies to the editor's own entry (no stale duplicate behind it).
    await releaseGuard();
    if (wasNew) {
      // A new programme / saved day moves to its edit URL (a different route
      // segment → a fresh editor with the saved data). Stay on the same day
      // and scroll position; the editor stays locked until it has moved.
      // (Counted among the days the save keeps — blank days are dropped.)
      const href = isTemplate
        ? editHref
        : `${editHref}?day=${savedDayIndex(days, selectedIndex) + 1}`;
      startNav(() => router.replace(href, { scroll: false }));
      return true;
    }
    // Refresh so server data (saved days…) is current.
    router.refresh();
    return false;
  }

  async function onSave() {
    if (saving || firstSaveLock) return;
    // A row without a name would be dropped by the save (with its cues) while
    // the editor kept showing it — block the save and point at the row.
    const unnamed = firstUnnamedExercise(days);
    if (unnamed) {
      setSelectedKey(days[unnamed.dayIndex].key);
      setError(
        isTemplate
          ? t("ed.error.unnamedExerciseInDay", { n: unnamed.exerciseIndex + 1 })
          : t("ed.error.unnamedExercise", {
              n: unnamed.exerciseIndex + 1,
              day: unnamed.dayIndex + 1,
            }),
      );
      return;
    }
    setError(null);
    setSaving(true);
    if (!currentId) lock(true);
    let moving = false;
    const sentSnapshot = snapshot;
    try {
      if (isTemplate) {
        const res = await saveTemplate({
          id: currentId,
          title,
          exercises: toSaveExercises(days[0].exercises),
        });
        if (!res.ok) return setError(res.error);
        moving = await afterSave(
          res.templateId,
          sentSnapshot,
          `/admin/programs/saved-days/${res.templateId}`,
          t("ed.toast.savedDaySaved"),
        );
      } else {
        const res = await saveProgram({
          id: currentId,
          kind: mode,
          clientId: mode === "client" ? clientId : null,
          title,
          monthStartDate: mode === "client" ? monthStartDate : null,
          notes,
          days: toSaveDays(days),
        });
        if (!res.ok) return setError(res.error);
        moving = await afterSave(
          res.programId,
          sentSnapshot,
          mode === "client"
            ? `/admin/clients/${clientId}/programs/${res.programId}/edit`
            : `/admin/programs/${res.programId}/edit`,
          t("ed.toast.programmeSaved"),
        );
      }
    } catch {
      // A network failure / expired session — nothing was saved.
      setError(t("ed.saveFailed"));
    } finally {
      setSaving(false);
      // Moving to the edit URL: stay locked until this instance is replaced.
      if (!moving) lock(false);
    }
  }

  async function onDeleteProgram() {
    if (!currentId || isTemplate) return;
    const message =
      mode === "catalog"
        ? t("catalog.confirmDelete", { title })
        : t("editor.confirmDeleteProgram");
    if (!confirm(message)) return;
    setError(null);
    setSaving(true);
    try {
      const res =
        mode === "catalog"
          ? await deleteCatalogProgram(currentId)
          : await deleteProgram({ programId: currentId, clientId });
      if (!res.ok) {
        setError(res.error);
        setSaving(false);
        return;
      }
      setSavedSnapshot(snapshot); // nothing left to warn about
      toast(t("toast.programDeleted"));
      await releaseGuard();
      router.push(backHref);
      router.refresh();
    } catch {
      setError(t("ed.deleteFailed"));
      setSaving(false);
    }
  }

  async function onDeleteSavedDay() {
    if (!currentId || !isTemplate) return;
    const id = currentId;
    const name = title.trim() || t("ed.fallback.savedDay");
    setError(null);
    setSaving(true);
    try {
      const res = await deleteSavedDay({ id });
      if (!res.ok) {
        setError(res.error);
        setSaving(false);
        return;
      }
      setSavedSnapshot(snapshot);
      // Soft delete: it sits in "Recently deleted" — Undo restores it now.
      toast(t("ed.toast.savedDayDeleted", { name }), {
        action: {
          label: t("ed.undo"),
          onClick: async () => {
            const restored = await restoreSavedDay({ id }).catch(() => null);
            if (restored?.ok) {
              toast(t("ed.toast.savedDayRestored", { name }));
              router.refresh();
            } else {
              toast.error(restored && !restored.ok ? restored.error : t("ed.restoreFailed"));
            }
          },
        },
      });
      await releaseGuard();
      router.push(SAVED_DAYS_HREF);
      router.refresh();
    } catch {
      setError(t("ed.deleteFailed"));
      setSaving(false);
    }
  }

  // ---- header ----
  const status: SaveStatus = saving
    ? { kind: "saving" }
    : dirty
      ? { kind: "dirty" }
      : !currentId
        ? { kind: "new" }
        : { kind: "saved", at: savedAt };

  const menuItems: OverflowMenuItem[] = [];
  if (currentId && mode === "catalog") {
    menuItems.push({
      label: t("catalog.assign"),
      Icon: UserPlus,
      disabled: saving || firstSaveLock,
      onSelect: async () => {
        if (!confirmLeave()) return;
        await releaseGuard();
        router.push(`/admin/programs/${currentId}/assign`);
      },
    });
  }
  if (currentId && !isTemplate) {
    menuItems.push({
      label: t("ed.deleteProgramme"),
      Icon: Trash2,
      danger: true,
      disabled: saving || firstSaveLock,
      onSelect: onDeleteProgram,
    });
  }
  if (currentId && isTemplate) {
    menuItems.push({
      label: t("ed.deleteSavedDay"),
      Icon: Trash2,
      danger: true,
      disabled: saving || firstSaveLock,
      onSelect: onDeleteSavedDay,
    });
  }

  // The day handed to the save dialog — a stable copy while the dialog is open.
  const saveDay = saveDayKey ? days.find((d) => d.key === saveDayKey) : undefined;
  const saveDayCopy = useMemo(() => (saveDay ? fromDayDraft(saveDay) : null), [saveDay]);
  // The save dialog's day, captured per render: its callbacks outlive the dialog.
  const saveKey = saveDay?.key ?? null;
  // The programme day the save links to: only when the programme is saved and
  // has no unsaved edits, so its position in the database is the editor's.
  const saveDayPosition = saveDay ? days.indexOf(saveDay) : -1;
  const saveLink =
    currentId && !isTemplate && !dirty && saveDay
      ? { programId: currentId, dayIndex: savedDayIndex(days, saveDayPosition) }
      : null;

  const nameConflict = isTemplate ? findSavedDayNameChangeConflict(title, savedDays, currentId) : null;

  // Snapshot the live editor state as a self-contained export document (works
  // for unsaved edits + brand-new programmes — the server resolves video ids).
  const getExportDoc = (): ExportDoc =>
    isTemplate
      ? {
          title: title.trim(),
          kind: "template",
          notes: null,
          monthStart: null,
          clientName: null,
          days: [{ title: "", exercises: toExportDays([{ ...days[0], title: "" }])[0]?.exercises ?? [] }],
        }
      : {
          title: title.trim(),
          kind: "program",
          notes: notes.trim() || null,
          monthStart: mode === "client" ? monthStartDate || null : null,
          clientName: mode === "client" ? clientName?.trim() || null : null,
          days: toExportDays(days),
        };

  const header = (
    <EditorHeader
      backHref={backHref}
      savedExport={!dirty && currentId ? { mode: isTemplate ? "template" : "program", id: currentId } : null}
      backLabel={backLabel}
      title={title}
      onTitleChange={setTitle}
      titleLabel={
        isTemplate
          ? t("ed.title.savedDay")
          : mode === "catalog"
            ? t("catalog.productName")
            : t("ed.title.programme")
      }
      titlePlaceholder={
        isTemplate
          ? t("ed.title.savedDayPlaceholder")
          : mode === "catalog"
            ? t("catalog.titlePlaceholder")
            : t("editor.titlePlaceholder")
      }
      titleWarning={nameConflict ? t("ed.nameConflict", { name: nameConflict.title }) : null}
      month={
        mode === "client"
          ? {
              value: monthStartDate,
              onChange: selectMonth,
              options: monthOptions.map((m) => ({
                value: m,
                label:
                  monthLabel(m, lang) +
                  (usedSet.has(m) && (!programId || m !== initial.monthStartDate)
                    ? ` ${t("editor.hasProgram")}`
                    : ""),
              })),
            }
          : null
      }
      status={status}
      getExportDoc={getExportDoc}
      onSave={() => void onSave()}
      saving={saving || firstSaveLock}
      locked={firstSaveLock}
      menuLabel={t("ed.moreActions")}
      menuItems={menuItems}
    />
  );

  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
      {error}
    </p>
  );

  const exerciseList = (day: DayDraft) => (
    <ExerciseList
      exercises={day.exercises}
      onChange={(next) => setDayExercises(day.key, next)}
      library={library}
      categories={categories}
      contentLang={contentLang ?? lang}
      resetKey={day.key}
      audience={mode === "client" ? "client" : "generic"}
    />
  );

  if (isTemplate) {
    const day = days[0];
    return (
      <div className="space-y-6" aria-busy={firstSaveLock || undefined}>
        {header}
        {errorBox}
        <section
          aria-labelledby="saved-day-exercises"
          inert={firstSaveLock}
          className="space-y-3"
        >
          <h2
            id="saved-day-exercises"
            className="flex flex-wrap items-baseline gap-x-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {t("ed.exercisesHeading")}
            <span className="font-medium normal-case tracking-normal text-subtle-foreground">
              {exercisesCount(lang, namedExercises(day.exercises).length)}
            </span>
          </h2>
          {exerciseList(day)}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-busy={firstSaveLock || undefined}>
      {header}
      <div inert={firstSaveLock}>
        <NotesPanel
          value={notes}
          onChange={setNotes}
          placeholder={
            mode === "client" ? t("ed.notes.placeholder") : t("ed.notes.catalogPlaceholder")
          }
        />
      </div>
      {errorBox}

      <div inert={firstSaveLock} className="grid gap-5 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <DayRail
            days={days}
            selectedKey={selectedDay.key}
            panelId={DAY_PANEL_ID}
            onSelect={setSelectedKey}
            onAddDay={addDay}
            onInsertSaved={() => setInsertOpen(true)}
            canInsertSaved={savedDays.length > 0 || savedDaysFailed}
            savedDaysHref={SAVED_DAYS_HREF}
          />
        </aside>

        <section
          id={DAY_PANEL_ID}
          role="tabpanel"
          aria-labelledby={dayTabId(selectedIndex)}
          className="min-w-0 space-y-5"
        >
          {/* No key: it holds no per-day state, and keeping it mounted keeps
              focus on Duplicate / the ⋯ trigger when the selection changes. */}
          <DayHeader
            day={selectedDay}
            dayNumber={selectedIndex + 1}
            dayCount={days.length}
            onTitleChange={(value) => setDays((ds) => patchDay(ds, selectedDay.key, { title: value }))}
            onSaveAsTemplate={() => setSaveDayKey(selectedDay.key)}
            updateTargetName={updateTarget?.title ?? null}
            onUpdateSavedDay={updateTarget ? () => setUpdateDayKey(selectedDay.key) : undefined}
            onDuplicate={onDuplicateDay}
            onMove={(dir) => setDays((ds) => moveDay(ds, selectedDay.key, dir))}
            onDelete={onDeleteDay}
          />
          {exerciseList(selectedDay)}
        </section>
      </div>

      {saveDay && saveDayCopy && (
        <SaveDayDialog
          open
          onClose={() => setSaveDayKey(null)}
          day={saveDayCopy}
          dayNumber={saveDayPosition + 1}
          sourceLabel={savedDaySourceLabel({
            clientName: mode === "client" ? clientName : null,
            monthStart: mode === "client" ? monthStartDate : null,
            programTitle: mode === "catalog" ? title : null,
            lang,
          })}
          savedDays={savedDays}
          link={saveLink}
          onSaved={({ templateId, linked }) => {
            if (!saveKey) return;
            const cur = latest.current;
            const next = patchDay(cur.days, saveKey, { sourceTemplateId: templateId });
            setDays(next);
            // Linked: the saved programme now holds the id, so the editor is clean.
            if (linked) {
              setSavedSnapshot(
                editorSnapshot({ title: cur.title, monthStartDate: cur.monthStartDate, notes: cur.notes, days: next }),
              );
            }
          }}
          onUndone={({ templateId, previousTemplateId, linked }) => {
            if (!mounted.current || !saveKey) return;
            const cur = latest.current;
            const wasClean = cur.snapshot === cur.savedSnapshot;
            const next = cur.days.map((d) =>
              d.key === saveKey && d.sourceTemplateId === templateId
                ? { ...d, sourceTemplateId: previousTemplateId }
                : d,
            );
            setDays(next);
            if (linked && wasClean) {
              setSavedSnapshot(
                editorSnapshot({ title: cur.title, monthStartDate: cur.monthStartDate, notes: cur.notes, days: next }),
              );
            }
          }}
        />
      )}
      {updateDayCopy && updateDayTarget && (
        <UpdateSavedDayDialog
          savedDay={updateDayTarget}
          day={updateDayCopy}
          onClose={() => setUpdateDayKey(null)}
        />
      )}
      {insertOpen && (
        <InsertSavedDayDialog
          open
          onClose={() => setInsertOpen(false)}
          savedDays={savedDays}
          loadFailed={savedDaysFailed}
          nextDayNumber={days.length + 1}
          onInsert={onInsertSavedDay}
        />
      )}
    </div>
  );
}
