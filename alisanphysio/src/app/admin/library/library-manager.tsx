"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseLibrary } from "@/lib/types";
import { parseYouTubeId } from "@/lib/youtube";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import YouTubeEmbed from "@/components/youtube-embed";
import {
  createLibraryExercise,
  updateLibraryExercise,
  deleteLibraryExercise,
} from "../library-actions";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

type Editing = ExerciseLibrary | "new" | null;

export default function LibraryManager({
  items,
}: {
  items: ExerciseLibrary[];
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [preview, setPreview] = useState<ExerciseLibrary | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const withVideo = items.filter((i) => i.youtube_url).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {t("lib.heading")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("lib.summary", { n: items.length, m: withVideo })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>{" "}
          {t("lib.newExercise")}
        </button>
      </div>

      <div className="mt-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("lib.search")}
          className={inputClass}
        />
      </div>

      <ul className="mt-6 space-y-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft sm:p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{item.name}</p>
                {item.youtube_url ? (
                  <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">
                    {t("lib.hasVideo")}
                  </span>
                ) : (
                  <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-subtle-foreground">
                    {t("lib.noVideo")}
                  </span>
                )}
              </div>
              {item.default_instructions && (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {item.default_instructions}
                </p>
              )}
            </div>
            {item.youtube_url && (
              <button
                type="button"
                onClick={() => setPreview(item)}
                aria-label={t("lib.previewAria", { name: item.name })}
                className="flex-none rounded-lg px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand-tint"
              >
                {t("lib.preview")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(item)}
              className="flex-none rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              {t("common.edit")}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-10 text-center text-sm text-subtle-foreground">
            {items.length === 0 ? t("lib.empty") : t("lib.noMatches")}
          </li>
        )}
      </ul>

      {editing && (
        <ExerciseModal editing={editing} onClose={() => setEditing(null)} />
      )}
      {preview && (
        <PreviewModal item={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

function PreviewModal({
  item,
  onClose,
}: {
  item: ExerciseLibrary;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoId = parseYouTubeId(item.youtube_url);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-lift sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-foreground">
            {item.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-foreground"
          >
            ✕
          </button>
        </div>
        {videoId ? (
          <div className="overflow-hidden rounded-xl">
            <YouTubeEmbed id={videoId} title={item.name} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-subtle-foreground">
            {t("lib.noValidVideo")}
          </p>
        )}
      </div>
    </div>
  );
}

function ExerciseModal({
  editing,
  onClose,
}: {
  editing: ExerciseLibrary | "new";
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const isNew = editing === "new";
  const existing = isNew ? null : editing;

  const [name, setName] = useState(existing?.name ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(existing?.youtube_url ?? "");
  const previewId = parseYouTubeId(youtubeUrl);
  const [defaultInstructions, setDefaultInstructions] = useState(
    existing?.default_instructions ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    const res = isNew
      ? await createLibraryExercise({ name, youtubeUrl, defaultInstructions })
      : await updateLibraryExercise({
          id: existing!.id,
          name,
          youtubeUrl,
          defaultInstructions,
        });
    if (res.ok) {
      toast(isNew ? t("toast.exerciseAdded") : t("toast.exerciseSaved"));
      router.refresh();
      onClose();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(t("lib.confirmDelete", { name: existing.name }))) return;
    setPending(true);
    const res = await deleteLibraryExercise({ id: existing.id });
    if (res.ok) {
      toast(t("toast.exerciseDeleted"));
      router.refresh();
      onClose();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-foreground">
          {isNew ? t("lib.newHeading") : t("lib.editHeading")}
        </h2>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("lib.name")}
            </span>
            <input
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Goblet Squat"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("lib.youtubeUrl")}{" "}
              <span className="text-subtle-foreground">{t("common.optional")}</span>
            </span>
            <input
              autoComplete="off"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className={inputClass}
              placeholder="https://youtu.be/… "
            />
          </label>

          {previewId ? (
            <div className="overflow-hidden rounded-xl shadow-soft">
              <YouTubeEmbed id={previewId} title={name.trim() || "Preview"} />
            </div>
          ) : (
            youtubeUrl.trim() !== "" && (
              <p className="text-xs text-subtle-foreground">
                {t("lib.enterValidUrl")}
              </p>
            )
          )}

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("lib.defaultInstructions")}{" "}
              <span className="text-subtle-foreground">{t("common.optional")}</span>
            </span>
            <textarea
              value={defaultInstructions}
              onChange={(e) => setDefaultInstructions(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder={t("lib.defaultInstructionsPlaceholder")}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {existing ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {t("common.delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
