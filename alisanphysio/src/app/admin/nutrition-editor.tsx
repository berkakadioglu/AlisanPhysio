"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FoodLibrary, NutritionPlanWithMeals } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import FoodCombobox from "./food-combobox";
import { IconBtn } from "./exercise-rows-editor";
import { saveNutritionPlan, deleteNutritionPlan } from "./nutrition-actions";

interface ItemRow {
  key: string;
  name: string;
  portion: string;
  note: string;
  library_id: string | null;
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
    name: "",
    portion: "",
    note: "",
    library_id: null,
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
          name: it.name,
          portion: it.portion ?? "",
          note: it.note ?? "",
          library_id: it.library_id,
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
  const { t } = useI18n();

  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [meals, setMeals] = useState<MealRow[]>(toMeals(plan));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
              portion: it.portion.trim() || food.default_portion || "",
            }
          : it,
      ),
    );

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await saveNutritionPlan({
      clientId,
      notes,
      meals: meals.map((m) => ({
        title: m.title,
        items: m.items.map((it) => ({
          name: it.name,
          portion: it.portion,
          note: it.note,
          library_id: it.library_id,
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

      {/* General notes */}
      <div className="mt-8 space-y-1.5 rounded-2xl bg-surface p-5 shadow-soft sm:p-6">
        <label className="block text-sm font-medium text-foreground">
          {t("nutri.notes")}{" "}
          <span className="text-subtle-foreground">{t("common.optional")}</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
          placeholder={t("nutri.notesPlaceholder")}
        />
      </div>

      {/* Meals */}
      <div className="mt-8 space-y-5">
        {meals.map((meal, mi) => (
          <div
            key={meal.key}
            className="space-y-4 rounded-2xl border border-border p-4 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <span className="flex-none rounded-full bg-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("nutri.mealLabel", { n: mi + 1 })}
              </span>
              <input
                value={meal.title}
                onChange={(e) => setMealTitle(meal.key, e.target.value)}
                autoComplete="off"
                className={`${inputClass} flex-1 font-medium`}
                placeholder={t("nutri.mealTitlePlaceholder")}
              />
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
                <IconBtn label={t("nutri.deleteMeal")} onClick={() => removeMeal(meal.key)}>
                  ✕
                </IconBtn>
              )}
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
              {meal.items.map((item, ii) => (
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
                    <FoodCombobox
                      items={foods}
                      value={item.name}
                      linked={Boolean(item.library_id)}
                      onPick={(food) => pickFood(meal.key, item.key, food)}
                      onType={(name) =>
                        updateItem(meal.key, item.key, { name, library_id: null })
                      }
                    />

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

                    <input
                      value={item.portion}
                      onChange={(e) =>
                        updateItem(meal.key, item.key, { portion: e.target.value })
                      }
                      autoComplete="off"
                      className={`${inputClass} sm:max-w-xs`}
                      placeholder={t("nutri.portion")}
                    />
                    <input
                      value={item.note}
                      onChange={(e) =>
                        updateItem(meal.key, item.key, { note: e.target.value })
                      }
                      autoComplete="off"
                      className={inputClass}
                      placeholder={t("nutri.itemNote")}
                    />
                  </div>
                </li>
              ))}
            </ol>

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
