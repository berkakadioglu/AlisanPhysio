"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import type { EditorDay } from "@/lib/program-editor-model";
import { SAVED_DAY_RETENTION_DAYS, savableExercises, savedDayDiff } from "@/lib/saved-days";
import type { TemplateWithExercises } from "@/lib/types";
import { SavedDayModal, SavedDayModalHeader } from "./save-day-dialog";
import { undoUpdateSavedDay, updateSavedDay } from "./template-actions";

/** Names shown per group; the rest are counted ("and N more"). */
const LIST_LIMIT = 8;

/**
 * "Update saved day": gives a saved day this programme day's exercises. It shows
 * what changes first (added, removed, changed, order); the saved day keeps its
 * id, name and origin, and its previous version goes to Recently deleted, which
 * the toast's Undo restores. Programmes that already used the saved day keep
 * their own copies.
 */
export default function UpdateSavedDayDialog({
  savedDay,
  day,
  onClose,
}: {
  savedDay: TemplateWithExercises;
  day: EditorDay;
  onClose(): void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const titleId = useId();
  const subtitleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diff = useMemo(
    () => savedDayDiff(savedDay.exercises, day.exercises),
    [savedDay.exercises, day.exercises],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || diff.same) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateSavedDay({
        id: savedDay.id,
        exercises: savableExercises(day.exercises),
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      const archivedId = res.archivedId;
      onClose();
      toast(t("sd.updatedToast", { name: savedDay.title }), {
        action: {
          label: t("sd.undo"),
          onClick: async () => {
            const undone = await undoUpdateSavedDay({ id: savedDay.id, archivedId }).catch(() => null);
            if (undone?.ok) toast(t("sd.updateUndone"));
            else toast.error(undone && !undone.ok ? undone.error : t("sd.undoError"));
            router.refresh();
          },
        },
      });
      router.refresh();
    } catch {
      setError(t("sd.updateError"));
      setBusy(false);
    }
  }

  return (
    <SavedDayModal labelledBy={titleId} describedBy={subtitleId} onClose={onClose}>
      <form onSubmit={submit} className="p-5 sm:p-7">
        <SavedDayModalHeader
          titleId={titleId}
          subtitleId={subtitleId}
          title={t("sd.updateTitle")}
          subtitle={t("sd.updateSubtitle", { name: savedDay.title })}
          icon={<RefreshCw className="h-5 w-5" />}
          onClose={onClose}
        />

        {diff.same ? (
          <p className="mt-6 rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
            {t("sd.updateNoChanges", { name: savedDay.title })}
          </p>
        ) : (
          <>
            <div className="mt-6 space-y-5">
              {diff.added.length > 0 && (
                <DiffGroup heading={t("sd.updateAdded")} count={diff.added.length}>
                  {diff.added.slice(0, LIST_LIMIT).map((name, i) => (
                    <li key={`added-${i}`} className="min-w-0 [overflow-wrap:anywhere]">
                      {name}
                    </li>
                  ))}
                </DiffGroup>
              )}
              {diff.removed.length > 0 && (
                <DiffGroup heading={t("sd.updateRemoved")} count={diff.removed.length}>
                  {diff.removed.slice(0, LIST_LIMIT).map((name, i) => (
                    <li key={`removed-${i}`} className="min-w-0 [overflow-wrap:anywhere]">
                      {name}
                    </li>
                  ))}
                </DiffGroup>
              )}
              {diff.changed.length > 0 && (
                <DiffGroup heading={t("sd.updateChanged")} count={diff.changed.length}>
                  {diff.changed.slice(0, LIST_LIMIT).map((item, i) => (
                    <li key={`changed-${i}`} className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="text-subtle-foreground"> — {item.fields.map((f) => t(`sd.change.${f}`)).join(", ")}</span>
                    </li>
                  ))}
                </DiffGroup>
              )}
              {diff.reordered && (
                <p className="text-sm font-medium text-foreground">{t("sd.updateReordered")}</p>
              )}
            </div>

            <div className="mt-5 space-y-2 text-xs leading-relaxed text-subtle-foreground">
              <p>{t("sd.updatePrevious", { days: SAVED_DAY_RETENTION_DAYS })}</p>
              <p>{t("sd.updateProgrammes")}</p>
            </div>
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
            disabled={diff.same || busy}
            className="min-h-11 rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("sd.updating") : t("sd.updateButton")}
          </button>
        </div>
      </form>
    </SavedDayModal>
  );
}

/** One heading and its (already capped) list, with the overflow count. */
function DiffGroup({
  heading,
  count,
  children,
}: {
  heading: string;
  count: number;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">{children}</ul>
      {count > LIST_LIMIT && (
        <p className="mt-1 text-sm text-subtle-foreground">{t("sd.andMore", { count: count - LIST_LIMIT })}</p>
      )}
    </div>
  );
}
