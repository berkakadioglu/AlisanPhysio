"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  FoodLibrary,
  NutritionUnit,
  NutritionPlanWithMeals,
  NutritionValues,
} from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import FoodCombobox from "./food-combobox";
import { IconBtn } from "./exercise-rows-editor";
import { saveNutritionPlan, deleteNutritionPlan } from "./nutrition-actions";
import {
  formatNutritionForDisplay,
  NUTRITION_UNITS,
  parseNutritionValueInput,
  parseQuantityInput,
  nutritionValueToInput,
  quantityToInput,
  resolveItemNutrition,
  roundNutritionForDisplay,
  sumNutritionTotals,
  type NutritionField,
  type NutritionTotals,
  type ResolvedItemNutrition,
} from "@/lib/nutrition-math";

interface ItemRow {
  key: string;
  id: string | null;
  name: string;
  portion: string;
  note: string;
  library_id: string | null;
  quantity: string;
  unit: NutritionUnit | "";
  isManualOverride: boolean;
  manualDirtyFields: NutritionField[];
  portionDirty: boolean;
  kcal: string;
  protein_g: string;
  carb_g: string;
  fat_g: string;
  saveToLibrary: boolean;
}

interface MealRow {
  key: string;
  title: string;
  items: ItemRow[];
}

let seq = 0;
const newKey = () => `n-${seq++}`;

function blankItem(): ItemRow {
  return {
    key: newKey(),
    id: null,
    name: "",
    portion: "",
    note: "",
    library_id: null,
    quantity: "",
    unit: "",
    isManualOverride: false,
    manualDirtyFields: [],
    portionDirty: false,
    kcal: "",
    protein_g: "",
    carb_g: "",
    fat_g: "",
    saveToLibrary: false,
  };
}

function blankMeal(title = ""): MealRow {
  return { key: newKey(), title, items: [blankItem()] };
}

function toMeals(plan: NutritionPlanWithMeals | null): MealRow[] {
  if (!plan || plan.meals.length === 0) return [blankMeal()];
  return plan.meals.map((m) => ({
    key: newKey(),
    title: m.title,
    items: m.items.length
      ? m.items.map((it) => ({
          key: newKey(),
          id: it.id,
          name: it.name,
          portion: it.portion ?? "",
          note: it.note ?? "",
          library_id: it.library_id,
          quantity: quantityToInput(it.quantity),
          unit: it.unit ?? "",
          isManualOverride: it.is_manual_override,
          manualDirtyFields: [],
          portionDirty: false,
          kcal: nutritionValueToInput(it.kcal),
          protein_g: nutritionValueToInput(it.protein_g),
          carb_g: nutritionValueToInput(it.carb_g),
          fat_g: nutritionValueToInput(it.fat_g),
          saveToLibrary: false,
        }))
      : [blankItem()],
  }));
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

const PRESETS = [
  "nutri.mealPreset.breakfast",
  "nutri.mealPreset.lunch",
  "nutri.mealPreset.dinner",
  "nutri.mealPreset.snack",
] as const;

function storedNutrition(item: ItemRow): NutritionValues {
  return {
    kcal: parseNutritionValueInput(item.kcal),
    protein_g: parseNutritionValueInput(item.protein_g),
    carb_g: parseNutritionValueInput(item.carb_g),
    fat_g: parseNutritionValueInput(item.fat_g),
  };
}

function parseQuantity(value: string): number | null {
  const parsed = parseQuantityInput(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function linkedFood(item: ItemRow, foods: FoodLibrary[]): FoodLibrary | null {
  if (!item.library_id) return null;
  return foods.find((food) => food.id === item.library_id) ?? null;
}

function resolveRow(item: ItemRow, foods: FoodLibrary[]): ResolvedItemNutrition {
  return resolveItemNutrition(
    {
      name: item.name,
      quantity: parseQuantity(item.quantity),
      unit: item.unit || null,
      isManualOverride: item.isManualOverride,
      storedValues: storedNutrition(item),
      library: linkedFood(item, foods),
    },
    { allowStoredFallback: Boolean(item.id) && !item.portionDirty },
  );
}

function resolvedValueToInput(
  field: NutritionField,
  value: number | null,
  lang: "en" | "tr" = "en",
): string {
  if (value === null) return "";
  const rounded = roundNutritionForDisplay(field, value);
  const neutral = field === "kcal" ? String(rounded) : rounded.toFixed(1);
  return lang === "tr" ? neutral.replace(".", ",") : neutral;
}

function manualValueForDisplay(
  item: ItemRow,
  field: NutritionField,
  lang: "en" | "tr",
): string {
  const value = item[field];
  if (item.manualDirtyFields.includes(field)) return value;
  return resolvedValueToInput(field, parseNutritionValueInput(value), lang);
}

function nutritionHintKey(
  resolution: ResolvedItemNutrition,
  food: FoodLibrary | null,
): string | null {
  switch (resolution.reason) {
    case "missing_library_nutrition":
      return "nutri.missingNutrition";
    case "missing_serving_quantity":
    case "invalid_serving_quantity":
    case "missing_serving_unit":
      return "nutri.missingServing";
    case "missing_gram_equivalent":
      return "nutri.needsGramEquivalent";
    case "mass_volume_mismatch":
    case "incompatible_units":
      return "nutri.incompatibleUnits";
    default:
      return food && (food.serving_qty === null || !food.serving_unit)
        ? "nutri.missingServing"
        : null;
  }
}

export default function NutritionEditor({
  clientId,
  clientName,
  plan,
  foods,
}: {
  clientId: string;
  clientName: string;
  plan: NutritionPlanWithMeals | null;
  foods: FoodLibrary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useI18n();

  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [dailyKcalTarget, setDailyKcalTarget] = useState(
    nutritionValueToInput(plan?.daily_kcal_target ?? null),
  );
  const [dailyProteinTarget, setDailyProteinTarget] = useState(
    nutritionValueToInput(plan?.daily_protein_target_g ?? null),
  );
  const [meals, setMeals] = useState<MealRow[]>(toMeals(plan));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mealTotals = useMemo(
    () =>
      new Map(
        meals.map((meal) => [
          meal.key,
          sumNutritionTotals(
            meal.items
              .filter((item) => item.name.trim())
              .map((item) => resolveRow(item, foods).values),
          ),
        ]),
      ),
    [foods, meals],
  );
  const dayTotals = useMemo(
    () =>
      sumNutritionTotals(
        meals.flatMap((meal) =>
          meal.items
            .filter((item) => item.name.trim())
            .map((item) => resolveRow(item, foods).values),
        ),
      ),
    [foods, meals],
  );
  const parsedDailyKcalTarget = parseNutritionValueInput(dailyKcalTarget);
  const dailyKcalTargetForSummary =
    parsedDailyKcalTarget !== null && parsedDailyKcalTarget > 0
      ? parsedDailyKcalTarget
      : null;
  const parsedDailyProteinTarget = parseNutritionValueInput(dailyProteinTarget);
  const dailyProteinTargetForSummary =
    parsedDailyProteinTarget !== null && parsedDailyProteinTarget > 0
      ? parsedDailyProteinTarget
      : null;

  // ---- meal mutations ----
  const patchMeal = (mealKey: string, fn: (m: MealRow) => MealRow) =>
    setMeals((ms) => ms.map((m) => (m.key === mealKey ? fn(m) : m)));

  const addMeal = () => setMeals((ms) => [...ms, blankMeal()]);
  const setMealTitle = (mealKey: string, title: string) =>
    patchMeal(mealKey, (m) => ({ ...m, title }));
  const removeMeal = (mealKey: string) =>
    setMeals((ms) => {
      const target = ms.find((m) => m.key === mealKey);
      const hasNamed = target?.items.some((it) => it.name.trim() !== "");
      if (hasNamed && !confirm(t("nutri.confirmDeleteMeal"))) return ms;
      const next = ms.filter((m) => m.key !== mealKey);
      return next.length ? next : [blankMeal()];
    });
  const moveMeal = (index: number, dir: -1 | 1) =>
    setMeals((ms) => {
      const next = [...ms];
      const j = index + dir;
      if (j < 0 || j >= next.length) return ms;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  // ---- item mutations (within a meal) ----
  const patchItems = (mealKey: string, fn: (items: ItemRow[]) => ItemRow[]) =>
    patchMeal(mealKey, (m) => ({ ...m, items: fn(m.items) }));

  const addItem = (mealKey: string) =>
    patchItems(mealKey, (items) => [...items, blankItem()]);
  const updateItem = (mealKey: string, itemKey: string, patch: Partial<ItemRow>) =>
    patchItems(mealKey, (items) =>
      items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)),
    );
  const removeItem = (mealKey: string, itemKey: string) =>
    patchItems(mealKey, (items) =>
      items.length > 1 ? items.filter((it) => it.key !== itemKey) : items,
    );
  const moveItem = (mealKey: string, index: number, dir: -1 | 1) =>
    patchItems(mealKey, (items) => {
      const next = [...items];
      const j = index + dir;
      if (j < 0 || j >= next.length) return items;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  const pickFood = (mealKey: string, itemKey: string, food: FoodLibrary) =>
    patchItems(mealKey, (items) =>
      items.map((it) =>
        it.key === itemKey
          ? {
              ...it,
              name: food.name,
              library_id: food.id,
              saveToLibrary: false,
              portion: food.default_portion || "",
              quantity: quantityToInput(food.serving_qty),
              unit:
                food.serving_qty !== null && food.serving_unit
                  ? food.serving_unit
                  : "",
              isManualOverride: false,
              manualDirtyFields: [],
              portionDirty: true,
              kcal: "",
              protein_g: "",
              carb_g: "",
              fat_g: "",
            }
          : it,
      ),
    );

  const typeFood = (mealKey: string, itemKey: string, name: string) =>
    updateItem(mealKey, itemKey, {
      name,
      library_id: null,
      isManualOverride: false,
      manualDirtyFields: [],
      portionDirty: true,
      kcal: "",
      protein_g: "",
      carb_g: "",
      fat_g: "",
    });

  const overrideNutrition = (
    mealKey: string,
    itemKey: string,
    field: NutritionField,
    value: string,
  ) =>
    patchItems(mealKey, (items) =>
      items.map((item) => {
        if (item.key !== itemKey) return item;
        const resolved = resolveRow(item, foods);
        const firstOverride = !item.isManualOverride;
        return {
          ...item,
          isManualOverride: true,
          manualDirtyFields: item.manualDirtyFields.includes(field)
            ? item.manualDirtyFields
            : [...item.manualDirtyFields, field],
          kcal: firstOverride
            ? nutritionValueToInput(resolved.values.kcal)
            : item.kcal,
          protein_g: firstOverride
            ? nutritionValueToInput(resolved.values.protein_g)
            : item.protein_g,
          carb_g: firstOverride
            ? nutritionValueToInput(resolved.values.carb_g)
            : item.carb_g,
          fat_g: firstOverride
            ? nutritionValueToInput(resolved.values.fat_g)
            : item.fat_g,
          [field]: value,
        };
      }),
    );

  const clearOverride = (mealKey: string, itemKey: string) =>
    updateItem(mealKey, itemKey, {
      isManualOverride: false,
      manualDirtyFields: [],
      portionDirty: true,
    });

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await saveNutritionPlan({
      clientId,
      notes,
      dailyKcalTarget,
      dailyProteinTarget,
      meals: meals.map((m) => ({
        title: m.title,
        items: m.items.map((it) => ({
          id: it.id,
          name: it.name,
          portion: it.portion,
          note: it.note,
          library_id: it.library_id,
          quantity: it.quantity,
          unit: it.unit || null,
          isManualOverride: it.isManualOverride,
          kcal: it.kcal,
          protein_g: it.protein_g,
          carb_g: it.carb_g,
          fat_g: it.fat_g,
          saveToLibrary: it.saveToLibrary && !it.library_id,
        })),
      })),
    });
    if (res.ok) {
      toast(t("toast.nutritionSaved"));
      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm(t("nutri.confirmDeletePlan"))) return;
    setSaving(true);
    const res = await deleteNutritionPlan({ clientId });
    if (res.ok) {
      toast(t("toast.nutritionDeleted"));
      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        href={`/admin/clients/${clientId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
      >
        <span aria-hidden>←</span> {t("editor.backToClient")}
      </Link>

      <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
        {t("nutri.editHeading")}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("nutri.editSubtitle", { name: clientName })}
      </p>

      {/* Plan-level settings */}
      <div className="mt-8 grid gap-5 rounded-2xl bg-surface p-5 shadow-soft sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <label className="block space-y-1.5 sm:col-span-2 lg:col-span-1">
          <span className="block text-sm font-medium text-foreground">
            {t("nutri.notes")}{" "}
            <span className="text-subtle-foreground">{t("common.optional")}</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder={t("nutri.notesPlaceholder")}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-foreground">
            {t("nutri.dailyTarget")}{" "}
            <span className="text-subtle-foreground">{t("common.optional")}</span>
          </span>
          <div className="relative">
            <input
              value={dailyKcalTarget}
              onChange={(event) => setDailyKcalTarget(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              className={`${inputClass} pr-14`}
              placeholder="2200"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle-foreground">
              {t("nutri.kcal")}
            </span>
          </div>
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-foreground">
            {t("nutri.dailyProteinTarget")} {" "}
            <span className="text-subtle-foreground">{t("common.optional")}</span>
          </span>
          <div className="relative">
            <input
              value={dailyProteinTarget}
              onChange={(event) => setDailyProteinTarget(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              className={`${inputClass} pr-10`}
              placeholder="150"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle-foreground">
              g
            </span>
          </div>
        </label>
      </div>

      {(dayTotals.hasAny ||
        dailyKcalTargetForSummary !== null ||
        dailyProteinTargetForSummary !== null) && (
        <NutritionTotalsCard
          title={
            dayTotals.hasAny && !dayTotals.isComplete
              ? t("nutri.trackedTotal")
              : t("nutri.dailyTotal")
          }
          totals={dayTotals}
          kcalTarget={dailyKcalTargetForSummary}
          proteinTarget={dailyProteinTargetForSummary}
          partialLabel={t("nutri.trackedTotal")}
          t={t}
          lang={lang}
        />
      )}

      {/* Meals */}
      <div className="mt-8 space-y-5">
        {meals.map((meal, mi) => (
          <div
            key={meal.key}
            className="space-y-4 rounded-2xl border border-border p-4 sm:p-5"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <span className="flex-none rounded-full bg-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("nutri.mealLabel", { n: mi + 1 })}
              </span>
              <input
                value={meal.title}
                onChange={(e) => setMealTitle(meal.key, e.target.value)}
                autoComplete="off"
                className={`${inputClass} col-span-2 row-start-2 font-medium sm:col-span-1 sm:row-start-auto`}
                placeholder={t("nutri.mealTitlePlaceholder")}
              />
              <div className="flex items-center justify-end gap-1">
                <IconBtn
                  label={t("nutri.moveMealUp")}
                  disabled={mi === 0}
                  onClick={() => moveMeal(mi, -1)}
                >
                  ↑
                </IconBtn>
                <IconBtn
                  label={t("nutri.moveMealDown")}
                  disabled={mi === meals.length - 1}
                  onClick={() => moveMeal(mi, 1)}
                >
                  ↓
                </IconBtn>
                {meals.length > 1 && (
                  <IconBtn
                    label={t("nutri.deleteMeal")}
                    onClick={() => removeMeal(meal.key)}
                  >
                    ✕
                  </IconBtn>
                )}
              </div>
            </div>

            {/* Preset chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-subtle-foreground">
                {t("nutri.presetsLabel")}:
              </span>
              {PRESETS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMealTitle(meal.key, t(key))}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-brand/40 hover:text-brand"
                >
                  {t(key)}
                </button>
              ))}
            </div>

            {/* Items */}
            <ol className="space-y-3">
              {meal.items.map((item, ii) => {
                const food = linkedFood(item, foods);
                const resolution = resolveRow(item, foods);
                const hintKey = nutritionHintKey(resolution, food);
                const manualActive = resolution.status === "manual_override";
                const canOverride = Boolean(
                  food &&
                    parseQuantity(item.quantity) !== null &&
                    item.unit &&
                    resolution.reason !== "missing_library_nutrition",
                );
                return (
                  <li
                    key={item.key}
                    className="rounded-2xl bg-surface p-4 shadow-soft sm:p-5"
                  >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-muted-foreground">
                      {ii + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconBtn
                        label={t("editor.moveUp")}
                        disabled={ii === 0}
                        onClick={() => moveItem(meal.key, ii, -1)}
                      >
                        ↑
                      </IconBtn>
                      <IconBtn
                        label={t("editor.moveDown")}
                        disabled={ii === meal.items.length - 1}
                        onClick={() => moveItem(meal.key, ii, 1)}
                      >
                        ↓
                      </IconBtn>
                      <IconBtn
                        label={t("editor.remove")}
                        disabled={meal.items.length === 1}
                        onClick={() => removeItem(meal.key, item.key)}
                      >
                        ✕
                      </IconBtn>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_8rem_10rem]">
                      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                        <FoodCombobox
                          items={foods}
                          value={item.name}
                          linkedId={item.library_id}
                          onPick={(food) => pickFood(meal.key, item.key, food)}
                          onType={(name) => typeFood(meal.key, item.key, name)}
                        />
                      </div>
                      <label className="min-w-0 space-y-1.5">
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          {t("nutri.quantity")}
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(meal.key, item.key, {
                              quantity: event.target.value,
                              portionDirty: true,
                            })
                          }
                          autoComplete="off"
                          className={inputClass}
                          placeholder="150"
                        />
                      </label>
                      <label className="min-w-0 space-y-1.5">
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          {t("nutri.unit")}
                        </span>
                        <select
                          value={item.unit}
                          onChange={(event) =>
                            updateItem(meal.key, item.key, {
                              unit: event.target.value as NutritionUnit | "",
                              portionDirty: true,
                            })
                          }
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

                    {!item.library_id && item.name.trim() !== "" && (
                      <label className="flex cursor-pointer items-center gap-2 px-0.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={item.saveToLibrary}
                          onChange={(e) =>
                            updateItem(meal.key, item.key, {
                              saveToLibrary: e.target.checked,
                            })
                          }
                          className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand/30"
                        />
                        {t("nutri.saveToFoodLibrary")}
                      </label>
                    )}

                    {item.portion && (!item.quantity || !item.unit) && (
                      <p className="rounded-lg bg-pill px-3 py-2 text-xs text-muted-foreground">
                        {t("nutri.legacyPortion", { portion: item.portion })}
                      </p>
                    )}
                    <fieldset className="min-w-0 rounded-xl border border-border p-3">
                      <legend className="px-1 text-xs font-medium text-muted-foreground">
                        {manualActive
                          ? t("nutri.manualOverride")
                          : t("nutri.calculatedNutrition")}
                      </legend>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        {manualActive ? (
                          <span className="rounded-full bg-pill px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {t("nutri.overrideHint")}
                          </span>
                        ) : (
                          <span className="text-[11px] text-subtle-foreground">
                            {t("nutri.macrosForPortion")}
                          </span>
                        )}
                        {item.isManualOverride && (
                          <button
                            type="button"
                            onClick={() => clearOverride(meal.key, item.key)}
                            className="text-xs font-semibold text-brand transition hover:text-brand-hover"
                          >
                            {t("nutri.clearOverride")}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <MacroInput
                          label={t("nutri.kcal")}
                          value={
                            manualActive
                              ? manualValueForDisplay(item, "kcal", lang)
                              : resolvedValueToInput(
                                  "kcal",
                                  resolution.values.kcal,
                                  lang,
                                )
                          }
                          onChange={(value) =>
                            overrideNutrition(meal.key, item.key, "kcal", value)
                          }
                          disabled={!canOverride}
                        />
                        <MacroInput
                          label={`${t("nutri.protein")} (g)`}
                          value={
                            manualActive
                              ? manualValueForDisplay(item, "protein_g", lang)
                              : resolvedValueToInput(
                                  "protein_g",
                                  resolution.values.protein_g,
                                  lang,
                                )
                          }
                          onChange={(value) =>
                            overrideNutrition(
                              meal.key,
                              item.key,
                              "protein_g",
                              value,
                            )
                          }
                          disabled={!canOverride}
                        />
                        <MacroInput
                          label={`${t("nutri.carbs")} (g)`}
                          value={
                            manualActive
                              ? manualValueForDisplay(item, "carb_g", lang)
                              : resolvedValueToInput(
                                  "carb_g",
                                  resolution.values.carb_g,
                                  lang,
                                )
                          }
                          onChange={(value) =>
                            overrideNutrition(meal.key, item.key, "carb_g", value)
                          }
                          disabled={!canOverride}
                        />
                        <MacroInput
                          label={`${t("nutri.fat")} (g)`}
                          value={
                            manualActive
                              ? manualValueForDisplay(item, "fat_g", lang)
                              : resolvedValueToInput(
                                  "fat_g",
                                  resolution.values.fat_g,
                                  lang,
                                )
                          }
                          onChange={(value) =>
                            overrideNutrition(meal.key, item.key, "fat_g", value)
                          }
                          disabled={!canOverride}
                        />
                      </div>
                      {!manualActive && hintKey && (
                        <p className="mt-3 text-xs leading-relaxed text-subtle-foreground">
                          {t(hintKey)}
                        </p>
                      )}
                    </fieldset>
                    <input
                      value={item.note}
                      onChange={(event) =>
                        updateItem(meal.key, item.key, {
                          note: event.target.value,
                        })
                      }
                      autoComplete="off"
                      className={inputClass}
                      placeholder={t("nutri.itemNote")}
                    />
                  </div>
                  </li>
                );
              })}
            </ol>

            {mealTotals.get(meal.key)?.hasAny && (
              <InlineTotals
                label={
                  mealTotals.get(meal.key)!.isComplete
                    ? t("nutri.mealTotal")
                    : t("nutri.trackedTotal")
                }
                totals={mealTotals.get(meal.key)!}
                t={t}
                lang={lang}
              />
            )}

            <button
              type="button"
              onClick={() => addItem(meal.key)}
              className="w-full rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-brand/40 hover:text-brand"
            >
              + {t("nutri.addItem")}
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addMeal}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>{" "}
          {t("nutri.addMeal")}
        </button>
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
            {saving ? t("common.saving") : t("nutri.save")}
          </button>
          <Link
            href={`/admin/clients/${clientId}`}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
          >
            {t("common.cancel")}
          </Link>
        </div>

        {plan && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger-tint disabled:opacity-60"
          >
            {t("nutri.deletePlan")}
          </button>
        )}
      </div>
    </>
  );
}

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function MacroInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block truncate text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        className={`${inputClass} disabled:cursor-not-allowed disabled:bg-pill disabled:text-subtle-foreground`}
        placeholder="—"
      />
    </label>
  );
}

function InlineTotals({
  label,
  totals,
  t,
  lang,
}: {
  label: string;
  totals: NutritionTotals;
  t: Translate;
  lang: "en" | "tr";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-pill px-3.5 py-2.5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{label}</span>
      {totals.kcal !== null && (
        <span>
          {formatNutritionForDisplay("kcal", totals.kcal, lang)} {t("nutri.kcal")}
        </span>
      )}
      {totals.protein_g !== null && (
        <span>
          {t("nutri.proteinShort")} {formatNutritionForDisplay("protein_g", totals.protein_g, lang)} g
        </span>
      )}
      {totals.carb_g !== null && (
        <span>
          {t("nutri.carbsShort")} {formatNutritionForDisplay("carb_g", totals.carb_g, lang)} g
        </span>
      )}
      {totals.fat_g !== null && (
        <span>
          {t("nutri.fatShort")} {formatNutritionForDisplay("fat_g", totals.fat_g, lang)} g
        </span>
      )}
    </div>
  );
}

function NutritionTotalsCard({
  title,
  totals,
  kcalTarget,
  proteinTarget,
  partialLabel,
  t,
  lang,
}: {
  title: string;
  totals: NutritionTotals;
  kcalTarget: number | null;
  proteinTarget: number | null;
  partialLabel: string;
  t: Translate;
  lang: "en" | "tr";
}) {
  return (
    <section className="mt-5 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {totals.isPartial && (
          <span className="rounded-full bg-pill px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {partialLabel}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:grid-cols-4">
        {(totals.kcal !== null || kcalTarget !== null) && (
          <TotalStat
            label={t("nutri.kcal")}
            value={formatAgainstTarget(
              "kcal",
              totals.kcal,
              kcalTarget,
              t("nutri.kcal"),
              lang,
            )}
          />
        )}
        {(totals.protein_g !== null || proteinTarget !== null) && (
          <TotalStat
            label={t("nutri.protein")}
            value={formatAgainstTarget(
              "protein_g",
              totals.protein_g,
              proteinTarget,
              "g",
              lang,
            )}
          />
        )}
        {totals.hasAny && totals.carb_g !== null && (
          <TotalStat
            label={t("nutri.carbs")}
            value={`${formatNutritionForDisplay("carb_g", totals.carb_g, lang)} g`}
          />
        )}
        {totals.hasAny && totals.fat_g !== null && (
          <TotalStat
            label={t("nutri.fat")}
            value={`${formatNutritionForDisplay("fat_g", totals.fat_g, lang)} g`}
          />
        )}
      </div>
    </section>
  );
}

function formatAgainstTarget(
  field: "kcal" | "protein_g",
  value: number | null,
  target: number | null,
  unit: string,
  lang: "en" | "tr",
): string {
  const current =
    value === null ? "—" : formatNutritionForDisplay(field, value, lang);
  const comparison =
    target === null
      ? current
      : `${current} / ${formatNutritionForDisplay(field, target, lang)}`;
  return `${comparison} ${unit}`;
}

function TotalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-pill px-3 py-2.5">
      <p className="break-words text-[11px] text-subtle-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}
