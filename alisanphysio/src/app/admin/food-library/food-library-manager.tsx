"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { FoodLibrary } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { createFood, deleteFood, updateFood } from "../food-library-actions";
import {
  formatNutritionForDisplay,
  hasCompleteNutritionValues,
  hasNutritionValues,
  NUTRITION_UNITS,
} from "@/lib/nutrition-math";
import { formatNutritionPortion } from "@/lib/nutrition-display";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

type Editing = FoodLibrary | "new" | null;
type NutritionFilter = "all" | "tracked" | "missing" | "conversion";

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i");
}

function localizedName(item: FoodLibrary, lang: "en" | "tr") {
  return lang === "tr" && item.name_tr?.trim() ? item.name_tr : item.name;
}

function needsGramEquivalent(item: FoodLibrary) {
  return (
    item.serving_unit !== null &&
    !["g", "ml"].includes(item.serving_unit) &&
    item.grams_per_unit === null
  );
}

function servingLabel(item: FoodLibrary, lang: "en" | "tr") {
  if (item.serving_qty === null || item.serving_unit === null) {
    return item.default_portion;
  }
  return formatNutritionPortion(item.serving_qty, item.serving_unit, lang);
}

export default function FoodLibraryManager({ foods }: { foods: FoodLibrary[] }) {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState("");
  const [nutritionFilter, setNutritionFilter] =
    useState<NutritionFilter>("all");
  const [editing, setEditing] = useState<Editing>(null);

  const searchRows = useMemo(
    () =>
      foods.map((food) => ({
        food,
        search: normalizeSearch(
          [food.name, food.name_tr, food.default_portion]
            .filter(Boolean)
            .join(" "),
        ),
      })),
    [foods],
  );
  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return searchRows
      .filter((row) => !q || row.search.includes(q))
      .filter(
        (row) =>
          nutritionFilter === "all" ||
          (nutritionFilter === "tracked"
            ? hasCompleteNutritionValues(row.food)
            : nutritionFilter === "missing"
              ? !hasCompleteNutritionValues(row.food)
              : needsGramEquivalent(row.food)),
      )
      .map((row) => row.food);
  }, [nutritionFilter, query, searchRows]);

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
        <div
          className="mt-3 flex flex-wrap gap-2"
          aria-label={t("food.nutritionPerPortion")}
        >
          {(
            [
              ["all", "food.filterAll"],
              ["tracked", "food.filterTracked"],
              ["missing", "food.filterMissing"],
              ["conversion", "food.filterMissingEquivalent"],
            ] as const
          ).map(([value, label]) => {
            const active = nutritionFilter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setNutritionFilter(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-brand/30 bg-brand-tint text-brand"
                    : "border-border bg-surface text-muted-foreground hover:border-brand/30 hover:text-brand"
                }`}
              >
                {t(label)}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-12 text-center text-sm text-subtle-foreground">
            {foods.length === 0 ? t("food.empty") : t("food.noMatches")}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                lang={lang}
                onEdit={() => setEditing(item)}
              />
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
  lang,
  onEdit,
}: {
  item: FoodLibrary;
  lang: "en" | "tr";
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const portion = servingLabel(item, lang);
  const missingNutrition = !hasCompleteNutritionValues(item);
  const missingEquivalent = needsGramEquivalent(item);
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">
            {localizedName(item, lang)}
          </h3>
          {item.name_tr && item.name_tr !== item.name && (
            <p className="mt-0.5 text-xs text-subtle-foreground">
              {lang === "tr" ? item.name : item.name_tr}
            </p>
          )}
        </div>
        {portion ? (
          <span className="flex-none rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">
            {portion}
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

      {(missingNutrition || missingEquivalent || item.serving_unit === null) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {missingNutrition && (
            <span className="rounded-full bg-pill px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {t("food.missingNutrition")}
            </span>
          )}
          {missingEquivalent && (
            <span className="rounded-full bg-pill px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {t("food.missingEquivalent")}
            </span>
          )}
          {item.serving_unit === null && (
            <span className="rounded-full bg-pill px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {t("food.missingServing")}
            </span>
          )}
        </div>
      )}

      {hasNutritionValues(item) && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {item.kcal !== null && (
            <span>{formatNutritionForDisplay("kcal", item.kcal, lang)} {t("food.kcal")}</span>
          )}
          {item.protein_g !== null && (
            <span>{t("food.proteinShort")} {formatNutritionForDisplay("protein_g", item.protein_g, lang)} g</span>
          )}
          {item.carb_g !== null && (
            <span>{t("food.carbsShort")} {formatNutritionForDisplay("carb_g", item.carb_g, lang)} g</span>
          )}
          {item.fat_g !== null && (
            <span>{t("food.fatShort")} {formatNutritionForDisplay("fat_g", item.fat_g, lang)} g</span>
          )}
        </div>
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
  const [nameTr, setNameTr] = useState(existing?.name_tr ?? "");
  const [defaultPortion, setDefaultPortion] = useState(
    existing?.default_portion ?? "",
  );
  const [servingQty, setServingQty] = useState(
    existing?.serving_qty?.toString() ?? "",
  );
  const [servingUnit, setServingUnit] = useState(
    existing?.serving_unit ?? "",
  );
  const [gramsPerUnit, setGramsPerUnit] = useState(
    existing?.grams_per_unit?.toString() ?? "",
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [kcal, setKcal] = useState(existing?.kcal?.toString() ?? "");
  const [proteinG, setProteinG] = useState(
    existing?.protein_g?.toString() ?? "",
  );
  const [carbG, setCarbG] = useState(existing?.carb_g?.toString() ?? "");
  const [fatG, setFatG] = useState(existing?.fat_g?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    const res = isNew
      ? await createFood({
          name,
          nameTr,
          defaultPortion,
          servingQty,
          servingUnit,
          gramsPerUnit,
          note,
          kcal,
          proteinG,
          carbG,
          fatG,
        })
      : await updateFood({
          id: existing!.id,
          name,
          nameTr,
          defaultPortion,
          servingQty,
          servingUnit,
          gramsPerUnit,
          note,
          kcal,
          proteinG,
          carbG,
          fatG,
        });
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
              {t("food.nameEn")}
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
              {t("food.nameTr")} {" "}
              <span className="text-subtle-foreground">{t("common.optional")}</span>
            </span>
            <input
              autoComplete="off"
              value={nameTr}
              onChange={(e) => setNameTr(e.target.value)}
              className={inputClass}
              placeholder="Sade süzme yoğurt"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("food.legacyPortion")}{" "}
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

          <fieldset className="space-y-3 rounded-xl border border-border p-3.5">
            <legend className="px-1 text-sm font-medium text-foreground">
              {t("food.servingDetails")}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="min-w-0 space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  {t("food.servingQty")}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={servingQty}
                  onChange={(event) => setServingQty(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="1"
                />
              </label>
              <label className="min-w-0 space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  {t("food.servingUnit")}
                </span>
                <select
                  value={servingUnit}
                  onChange={(event) => {
                    setServingUnit(event.target.value);
                    if (["g", "ml"].includes(event.target.value)) {
                      setGramsPerUnit("");
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {NUTRITION_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`nutri.unit.${unit}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {servingUnit && !["g", "ml"].includes(servingUnit) && (
              <label className="block space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  {t("food.gramsPerUnit")}{" "}
                  <span className="font-normal text-subtle-foreground">
                    {t("common.optional")}
                  </span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={gramsPerUnit}
                  onChange={(event) => setGramsPerUnit(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="118"
                />
                <span className="block text-xs leading-relaxed text-subtle-foreground">
                  {t("food.gramsPerUnitHint")}
                </span>
              </label>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-border p-3.5">
            <legend className="px-1 text-sm font-medium text-foreground">
              {t("food.nutritionPerPortion")}{" "}
              <span className="font-normal text-subtle-foreground">
                {t("common.optional")}
              </span>
            </legend>
            <p className="text-xs leading-relaxed text-subtle-foreground">
              {t("food.nutritionForServing")}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MacroInput label={t("food.kcal")} value={kcal} onChange={setKcal} />
              <MacroInput
                label={`${t("food.protein")} (g)`}
                value={proteinG}
                onChange={setProteinG}
              />
              <MacroInput
                label={`${t("food.carbs")} (g)`}
                value={carbG}
                onChange={setCarbG}
              />
              <MacroInput
                label={`${t("food.fat")} (g)`}
                value={fatG}
                onChange={setFatG}
              />
            </div>
          </fieldset>

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

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        className={inputClass}
        placeholder="—"
      />
    </label>
  );
}
