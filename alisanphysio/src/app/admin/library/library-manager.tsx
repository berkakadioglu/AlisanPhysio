"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import type { CategoryWithCount, LibraryExercise } from "@/lib/types";
import { parseYouTubeId } from "@/lib/youtube";
import { categoryLabel, type Lang } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import YouTubeEmbed from "@/components/youtube-embed";
import {
  createCategory,
  createLibraryExercise,
  deleteCategory,
  deleteLibraryExercise,
  renameCategory,
  updateLibraryExercise,
} from "../library-actions";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

type Editing = LibraryExercise | "new" | null;

export default function LibraryManager({
  exercises,
  categories,
}: {
  exercises: LibraryExercise[];
  categories: CategoryWithCount[];
}) {
  const { t, lang } = useI18n();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [preview, setPreview] = useState<LibraryExercise | null>(null);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const withVideo = exercises.filter((e) => e.youtube_url).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (activeCat === null || e.category_ids.includes(activeCat)) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, activeCat, query]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {t("lib.heading")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("lib.summary", { n: exercises.length, m: withVideo })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          {t("lib.newExercise")}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <CategorySidebar
          categories={categories}
          total={exercises.length}
          activeCat={activeCat}
          onSelect={setActiveCat}
        />

        <div className="min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("lib.search")}
            className={inputClass}
          />

          {filtered.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-12 text-center text-sm text-subtle-foreground">
              {exercises.length === 0
                ? t("lib.empty")
                : query
                  ? t("lib.noMatches")
                  : t("cat.emptyGrid")}
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((item) => (
                <ExerciseCard
                  key={item.id}
                  item={item}
                  cats={item.category_ids
                    .map((id) => catById.get(id))
                    .filter((c): c is CategoryWithCount => Boolean(c))}
                  lang={lang}
                  onEdit={() => setEditing(item)}
                  onPreview={() => setPreview(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <ExerciseModal
          editing={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Category sidebar
// ---------------------------------------------------------------------------
function CategorySidebar({
  categories,
  total,
  activeCat,
  onSelect,
}: {
  categories: CategoryWithCount[];
  total: number;
  activeCat: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function submitAdd() {
    const name = draft.trim();
    if (!name || pending) return;
    setPending(true);
    const res = await createCategory({ name });
    setPending(false);
    if (res.ok) {
      toast(t("toast.categoryAdded"));
      setAdding(false);
      setDraft("");
      router.refresh();
    } else {
      toast(res.error);
    }
  }

  async function submitRename(id: string) {
    const name = draft.trim();
    if (!name || pending) return;
    setPending(true);
    const res = await renameCategory({ id, name });
    setPending(false);
    if (res.ok) {
      toast(t("toast.categoryUpdated"));
      setRenamingId(null);
      setDraft("");
      router.refresh();
    } else {
      toast(res.error);
    }
  }

  async function remove(c: CategoryWithCount) {
    if (!confirm(t("cat.confirmDelete", { name: categoryLabel(lang, c) }))) return;
    const res = await deleteCategory({ id: c.id });
    if (res.ok) {
      toast(t("toast.categoryDeleted"));
      if (activeCat === c.id) onSelect(null);
      router.refresh();
    } else {
      toast(res.error);
    }
  }

  // On mobile the sidebar collapses to a compact toggle showing the active
  // category, so the full list doesn't eat the screen above the exercise grid.
  const [catOpen, setCatOpen] = useState(false);
  const activeLabel =
    activeCat === null
      ? t("cat.all")
      : categoryLabel(
          lang,
          categories.find((c) => c.id === activeCat) ?? {
            name: "",
            is_default: false,
          },
        );
  const handleSelect = (id: string | null) => {
    onSelect(id);
    setCatOpen(false);
  };

  const rowBase =
    "group flex items-center gap-1 rounded-xl pr-1 transition";
  const filterBtn = (active: boolean) =>
    `flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
      active
        ? "bg-brand-tint text-brand"
        : "text-muted-foreground hover:bg-pill hover:text-foreground"
    }`;
  const countPill = (active: boolean) =>
    `flex-none rounded-full px-2 py-0.5 text-xs tabular-nums ${
      active ? "bg-brand/15 text-brand" : "bg-pill text-subtle-foreground"
    }`;

  return (
    <aside className="w-full flex-none rounded-2xl border border-border bg-surface p-3 shadow-soft lg:w-64">
      {/* Mobile: compact toggle showing the active category */}
      <button
        type="button"
        onClick={() => setCatOpen((o) => !o)}
        aria-expanded={catOpen}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 lg:hidden"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-subtle-foreground">
          {t("cat.heading")}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="truncate">{activeLabel}</span>
          <ChevronDown
            className={`h-4 w-4 flex-none transition ${catOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      {/* Desktop: static heading */}
      <p className="hidden px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-widest text-subtle-foreground lg:block">
        {t("cat.heading")}
      </p>

      <div className={`${catOpen ? "mt-2" : "hidden"} lg:mt-0 lg:block`}>
        <div className="space-y-0.5">
          {/* All */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={filterBtn(activeCat === null)}
          >
          <span className="truncate">{t("cat.all")}</span>
          <span className={countPill(activeCat === null)}>{total}</span>
        </button>

        {categories.map((c) =>
          renamingId === c.id ? (
            <RenameRow
              key={c.id}
              value={draft}
              pending={pending}
              onChange={setDraft}
              onSubmit={() => submitRename(c.id)}
              onCancel={() => {
                setRenamingId(null);
                setDraft("");
              }}
            />
          ) : (
            <div key={c.id} className={rowBase}>
              <button
                type="button"
                onClick={() => handleSelect(c.id)}
                className={filterBtn(activeCat === c.id)}
              >
                <span className="truncate">{categoryLabel(lang, c)}</span>
                <span className={countPill(activeCat === c.id)}>{c.count}</span>
              </button>
              {!c.is_default && (
                <span className="flex flex-none items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(c.id);
                      setDraft(c.name);
                      setAdding(false);
                    }}
                    aria-label={t("cat.rename")}
                    title={t("cat.rename")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={t("cat.delete")}
                    title={t("cat.delete")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger-tint hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              )}
            </div>
          ),
        )}
      </div>

      <div className="mt-2 border-t border-border pt-2">
        {adding ? (
          <RenameRow
            value={draft}
            pending={pending}
            placeholder={t("cat.namePlaceholder")}
            onChange={setDraft}
            onSubmit={submitAdd}
            onCancel={() => {
              setAdding(false);
              setDraft("");
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setRenamingId(null);
              setDraft("");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-brand transition hover:bg-brand-tint"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            {t("cat.add")}
          </button>
        )}
        </div>
      </div>
    </aside>
  );
}

/** Inline name input shared by "add category" and "rename category". */
function RenameRow({
  value,
  pending,
  placeholder,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  pending: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        aria-label={t("cat.save")}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-solid text-white transition hover:bg-brand-solid-hover disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label={t("common.cancel")}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exercise card
// ---------------------------------------------------------------------------
function ExerciseCard({
  item,
  cats,
  lang,
  onEdit,
  onPreview,
}: {
  item: LibraryExercise;
  cats: CategoryWithCount[];
  lang: Lang;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-semibold text-foreground">{item.name}</h3>
        {item.youtube_url ? (
          <span className="flex flex-none items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">
            <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} aria-hidden />
            {t("lib.hasVideo")}
          </span>
        ) : (
          <span className="flex-none rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-subtle-foreground">
            {t("lib.noVideo")}
          </span>
        )}
      </div>

      {cats.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-pill px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {categoryLabel(lang, c)}
            </span>
          ))}
        </div>
      )}

      {item.default_instructions && (
        <p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">
          {item.default_instructions}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
        >
          {t("common.edit")}
        </button>
        {item.youtube_url && (
          <button
            type="button"
            onClick={onPreview}
            aria-label={t("lib.previewAria", { name: item.name })}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand-tint"
          >
            {t("lib.preview")}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview modal (unchanged behavior)
// ---------------------------------------------------------------------------
function PreviewModal({
  item,
  onClose,
}: {
  item: LibraryExercise;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoId = parseYouTubeId(item.youtube_url);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
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

// ---------------------------------------------------------------------------
// Add / edit exercise modal — now with a category multi-select
// ---------------------------------------------------------------------------
function ExerciseModal({
  editing,
  categories,
  onClose,
}: {
  editing: LibraryExercise | "new";
  categories: CategoryWithCount[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const toast = useToast();
  const isNew = editing === "new";
  const existing = isNew ? null : editing;

  const [name, setName] = useState(existing?.name ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(existing?.youtube_url ?? "");
  const previewId = parseYouTubeId(youtubeUrl);
  const [defaultInstructions, setDefaultInstructions] = useState(
    existing?.default_instructions ?? "",
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(existing?.category_ids ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleCat(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setError(null);
    setPending(true);
    const categoryIds = [...selected];
    const res = isNew
      ? await createLibraryExercise({ name, youtubeUrl, defaultInstructions, categoryIds })
      : await updateLibraryExercise({
          id: existing!.id,
          name,
          youtubeUrl,
          defaultInstructions,
          categoryIds,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
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

          {/* Category multi-select */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("cat.assignLabel")}{" "}
              <span className="text-subtle-foreground">{t("common.optional")}</span>
            </span>
            {categories.length === 0 ? (
              <p className="text-xs text-subtle-foreground">{t("cat.assignHint")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCat(c.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        on
                          ? "border-transparent bg-brand-solid text-white"
                          : "border-border bg-surface text-muted-foreground hover:border-brand/40 hover:text-foreground"
                      }`}
                    >
                      {categoryLabel(lang, c)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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
              className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
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
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-danger-tint disabled:opacity-60"
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
              className="rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
