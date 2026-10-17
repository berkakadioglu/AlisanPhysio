"use client";

import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import RichText from "@/components/rich-text";
import { programmesCount, savedDaysCount } from "@/lib/i18n";
import type { LibraryDiff, LibrarySyncValues } from "@/lib/library-sync";
import { isRichTextEmpty } from "@/lib/rich-text";
import type { LibraryExercise } from "@/lib/types";
import { parseYouTubeId, youtubeThumb } from "@/lib/youtube";
import { libraryExerciseUsage, updateLibraryFromExercise } from "../library-actions";
import { SavedDayModal, SavedDayModalHeader } from "../save-day-dialog";
import type { ExerciseDraft } from "./drafts";
import { HATCH } from "./exercise-row";

/** Sentinels for the two counts in the video sentence, so each one can be set in bold. */
const PROGRAMMES_MARK = "\uE000";
const SAVED_DAYS_MARK = "\uE001";

type Usage = { programmes: number; savedDays: number };
/** `ok: false` means the count failed and the dialog offers a retry. */
type UsageResult = ({ ok: true } & Usage) | { ok: false };

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{label}</p>
      <div className="mt-2 min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

/** The cues as they render in the programme, or the empty label. */
function CuesPreview({ value, emptyLabel }: { value: string | null; emptyLabel: string }) {
  if (isRichTextEmpty(value)) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return <RichText value={value} />;
}

/** A 16:9 YouTube thumbnail, or the hatched "no video" surface. */
function VideoPreview({ videoId, emptyLabel }: { videoId: string | null; emptyLabel: string }) {
  if (!videoId) {
    return (
      <div className={`flex aspect-video w-full items-center justify-center rounded-lg ${HATCH}`}>
        <span className="mx-3 rounded-full bg-surface px-3 py-1 text-center text-xs font-medium text-muted-foreground shadow-soft">
          {emptyLabel}
        </span>
      </div>
    );
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-pill">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={youtubeThumb(videoId)} alt="" loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * "Update library exercise": shows what the library holds now next to what the
 * row would put there (only the fields that differ), how far a video change
 * reaches, and writes the change on confirm. The editor row itself keeps its
 * own cues and video.
 */
export default function LibrarySyncDialog({
  entry,
  row,
  diff,
  onClose,
  onUpdated,
}: {
  entry: LibraryExercise;
  row: ExerciseDraft;
  diff: LibraryDiff;
  onClose: () => void;
  onUpdated: (previous: LibrarySyncValues, next: LibrarySyncValues) => void;
}) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const subtitleId = useId();
  const cuesId = useId();
  const videoHeadingId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // How many programmes and saved days the library video reaches. Only the
  // video block shows it, so the count is read only when the video changes.
  const [attempt, setAttempt] = useState(0);
  const [usage, setUsage] = useState<{ attempt: number; result: UsageResult } | null>(null);
  useEffect(() => {
    if (!diff.video) return;
    let live = true;
    const finish = (result: UsageResult) => {
      if (live) setUsage({ attempt, result });
    };
    libraryExerciseUsage({ id: entry.id }).then(finish, () => finish({ ok: false }));
    return () => {
      live = false;
    };
  }, [attempt, diff.video, entry.id]);

  // null while the count for the current attempt is still loading.
  const current = usage && usage.attempt === attempt ? usage.result : null;
  const usageReady = !diff.video || (current !== null && current.ok);
  const canConfirm = !busy && usageReady;

  function usageSentence(counts: Usage): ReactNode {
    if (counts.programmes + counts.savedDays === 0) return t("lib.sync.videoEffectNone");
    const parts = t("lib.sync.videoEffect", {
      programmes: PROGRAMMES_MARK,
      savedDays: SAVED_DAYS_MARK,
    }).split(/(\uE000|\uE001)/u);
    return parts.map((part, i) => {
      if (part === PROGRAMMES_MARK) {
        return (
          <strong key={i} className="font-semibold text-foreground">
            {programmesCount(lang, counts.programmes)}
          </strong>
        );
      }
      if (part === SAVED_DAYS_MARK) {
        return (
          <strong key={i} className="font-semibold text-foreground">
            {savedDaysCount(lang, counts.savedDays)}
          </strong>
        );
      }
      return <Fragment key={i}>{part}</Fragment>;
    });
  }

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    const res = await updateLibraryFromExercise({
      id: entry.id,
      ...(diff.cues ? { instructions: row.instructions } : {}),
      ...(diff.video ? { videoUrl: row.media_url } : {}),
    }).catch(() => null);
    if (!res) {
      setError(t("lib.sync.updateError"));
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onUpdated(res.previous, res.next);
    onClose();
  }

  const noCues = t("lib.sync.noCues");
  const noVideo = t("lib.sync.noVideo");

  return (
    <SavedDayModal labelledBy={titleId} describedBy={subtitleId} onClose={onClose} className="max-w-2xl">
      <div className="p-5 sm:p-7">
        <SavedDayModalHeader
          titleId={titleId}
          subtitleId={subtitleId}
          title={t("lib.sync.title")}
          subtitle={t("lib.sync.subtitle", { name: entry.name })}
          icon={<RefreshCw className="h-5 w-5" />}
          onClose={onClose}
        />

        <div className="mt-6 space-y-6">
          {diff.cues && (
            <section aria-labelledby={cuesId} className="space-y-2.5">
              <h3 id={cuesId} className="text-sm font-semibold text-foreground">
                {t("lib.sync.fieldCues")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Panel label={t("lib.sync.before")}>
                  <CuesPreview value={entry.default_instructions} emptyLabel={noCues} />
                </Panel>
                <Panel label={t("lib.sync.after")}>
                  <CuesPreview value={row.instructions} emptyLabel={noCues} />
                </Panel>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("lib.sync.cuesEffect")}</p>
            </section>
          )}

          {diff.video && (
            <section aria-labelledby={videoHeadingId} className="space-y-2.5">
              <h3 id={videoHeadingId} className="text-sm font-semibold text-foreground">
                {t("lib.sync.fieldVideo")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Panel label={t("lib.sync.before")}>
                  <VideoPreview videoId={parseYouTubeId(entry.youtube_url)} emptyLabel={noVideo} />
                </Panel>
                <Panel label={t("lib.sync.after")}>
                  <VideoPreview videoId={parseYouTubeId(row.media_url)} emptyLabel={noVideo} />
                </Panel>
              </div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                {current === null ? (
                  <p role="status">{t("lib.sync.counting")}</p>
                ) : current.ok ? (
                  <p>{usageSentence(current)}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-danger">{t("lib.sync.countFailed")}</span>
                    <button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                      className="inline-flex min-h-9 items-center rounded-md px-1.5 font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {t("lib.sync.retry")}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

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
            type="button"
            onClick={() => void confirm()}
            disabled={!canConfirm}
            className="min-h-11 rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("lib.sync.updating") : t("lib.sync.confirm")}
          </button>
        </div>
      </div>
    </SavedDayModal>
  );
}
