"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { FoodLibrary } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { createFood, deleteFood, updateFood } from "../food-library-actions";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

type Editing = FoodLibrary | "new" | null;

export default function FoodLibraryManager({ foods }: { foods: FoodLibrary[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? foods.filter((f) => f.name.toLowerCase().includes(q))
      : foods;
  }, [foods, query]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {t("food.heading")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("food.summary", { n: foods.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          {t("food.newFood")}
        </button>
      </div>

      <div className="mt-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("food.search")}
          className={inputClass}
        />

        {filtered.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-12 text-center text-sm text-subtle-foreground">
            {foods.length === 0 ? t("food.empty") : t("food.noMatches")}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((item) => (
              <FoodCard key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <FoodModal editing={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function FoodCard({
  item,
  onEdit,
}: {
  item: FoodLibrary;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-semibold text-foreground">{item.name}</h3>
        {item.default_portion ? (
          <span className="flex-none rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">
            {item.default_portion}
          </span>
        ) : (
          <span className="flex-none rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-subtle-foreground">
            {t("food.noPortion")}
          </span>
        )}
      </div>

      {item.note && (
        <p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">
          {item.note}
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
      </div>
    </div>
  );
}

function FoodModal({
  editing,
  onClose,
}: {
  editing: FoodLibrary | "new";
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const isNew = editing === "new";
  const existing = isNew ? null : editing;

  const [name, setName] = useState(existing?.name ?? "");
  const [defaultPortion, setDefaultPortion] = useState(
    existing?.default_portion ?? "",
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    const res = isNew
      ? await createFood({ name, defaultPortion, note })
      : await updateFood({ id: existing!.id, name, defaultPortion, note });
    if (res.ok) {
      toast(isNew ? t("toast.foodAdded") : t("toast.foodSaved"));
      router.refresh();
      onClose();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(t("food.confirmDelete", { name: existing.name }))) return;
    setPending(true);
    const res = await deleteFood({ id: existing.id });
    if (res.ok) {
      toast(t("toast.foodDeleted"));
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
          {isNew ? t("food.newHeading") : t("food.editHeading")}
        </h2>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("food.name")}
            </span>
            <input
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Greek yogurt"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("food.defaultPortion")}{" "}
              <span className="text-subtle-foreground">{t("common.optional")}</span>
            </span>
            <input
              autoComplete="off"
              value={defaultPortion}
              onChange={(e) => setDefaultPortion(e.target.value)}
              className={inputClass}
              placeholder={t("food.defaultPortionPlaceholder")}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("food.note")}{" "}
              <span className="text-subtle-foreground">{t("common.optional")}</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder={t("food.notePlaceholder")}
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
