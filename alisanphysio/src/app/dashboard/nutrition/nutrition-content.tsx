import { t, type Lang } from "@/lib/i18n";
import {
  formatNutritionForDisplay,
  legacyPortionFallback,
  resolveMealItemNutrition,
  sumNutritionTotals,
  type NutritionField,
  type NutritionTotals,
  type ResolvedItemNutrition,
} from "@/lib/nutrition-math";
import { formatNutritionPortion } from "@/lib/nutrition-display";
import type {
  MealItem,
  NutritionPlanWithMeals,
  NutritionValues,
} from "@/lib/types";
import DashboardSectionIntro, {
  DashboardEmptyState,
} from "@/components/dashboard-section-intro";

interface DisplayItem {
  item: MealItem;
  nutrition: ResolvedItemNutrition;
}

/**
 * The client nutrition view: plan notes, daily summary and meals. Shared by the
 * client's own nutrition route and the staff "view as client" preview, so it
 * renders no controls of its own.
 */
export function ClientNutritionView({
  plan,
  lang,
}: {
  plan: NutritionPlanWithMeals | null;
  lang: Lang;
}) {
  const meals = (plan?.meals ?? []).map((meal) => {
    const items: DisplayItem[] = meal.items.map((item) => ({
      item,
      nutrition: resolveMealItemNutrition(item),
    }));
    return {
      ...meal,
      displayItems: items,
      totals: sumNutritionTotals(items.map(({ nutrition }) => nutrition.values)),
    };
  });
  const dayTotals = sumNutritionTotals(
    meals.flatMap((meal) =>
      meal.displayItems.map(({ nutrition }) => nutrition.values),
    ),
  );

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-5xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "nutriClient.eyebrow")}
        title={t(lang, "nutriClient.heading")}
      />

      {plan?.notes && (
        <div className="mt-7 rounded-2xl border border-brand/15 bg-brand-tint p-5 sm:p-6">
          <p className="text-sm font-semibold text-brand">
            {t(lang, "nutriClient.notesFrom")}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
            {plan.notes}
          </p>
        </div>
      )}

      {plan &&
        (dayTotals.hasAny ||
          plan.daily_kcal_target !== null ||
          plan.daily_protein_target_g !== null) && (
          <DailySummary
            totals={dayTotals}
            kcalTarget={plan.daily_kcal_target}
            proteinTarget={plan.daily_protein_target_g}
            lang={lang}
          />
        )}

      {!plan || meals.length === 0 ? (
        <div className="mt-9">
          <DashboardEmptyState
            title={t(lang, "nutriClient.emptyFull")}
            body={t(lang, "nutriClient.emptyFullHint")}
          />
        </div>
      ) : (
        <div className="mt-9 space-y-6">
          {meals.map((meal) => (
            <section
              key={meal.id}
              className="min-w-0 rounded-3xl border border-border bg-surface p-4 shadow-soft sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-foreground">
                  {meal.title}
                </h2>
                {meal.totals.hasAny && (
                  <InlineTotals totals={meal.totals} lang={lang} />
                )}
              </div>

              {meal.displayItems.length === 0 ? (
                <div className="mt-4">
                  <DashboardEmptyState
                    compact
                    title={t(lang, "nutriClient.emptyMeal")}
                    body={t(lang, "nutriClient.emptyMealHint")}
                  />
                </div>
              ) : (
                <ul className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
                  {meal.displayItems.map(({ item, nutrition }) => {
                    const portion = itemPortionLabel(item, lang);
                    return (
                      <li
                        key={item.id}
                        className="min-w-0 rounded-2xl border border-border/70 bg-background/55 p-4"
                      >
                        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="min-w-0 break-words text-base font-semibold text-foreground">
                            {localizedItemName(item, lang)}
                          </h3>
                          {portion && (
                            <span className="flex-none text-sm font-semibold text-brand-bright">
                              {portion}
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {item.note}
                          </p>
                        )}
                        {nutrition.hasAny && (
                          <ItemMacros values={nutrition.values} lang={lang} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function DailySummary({
  totals,
  kcalTarget,
  proteinTarget,
  lang,
}: {
  totals: NutritionTotals;
  kcalTarget: number | null;
  proteinTarget: number | null;
  lang: Lang;
}) {
  return (
    <section className="mt-7 rounded-3xl border border-border bg-surface p-4 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-foreground">
          {t(lang, "nutriClient.dailySummary")}
        </h2>
        {totals.isPartial && (
          <span className="rounded-full bg-pill px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {t(lang, "nutriClient.trackedTotal")}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 lg:grid-cols-4">
        {(totals.kcal !== null || kcalTarget !== null) && (
          <SummaryStat
            label={
              totals.kcal !== null
                ? totals.fieldComplete.kcal
                  ? t(lang, "nutriClient.dailyTotal")
                  : t(lang, "nutriClient.trackedTotal")
                : t(lang, "nutriClient.dailyTarget")
            }
            value={targetValue("kcal", totals.kcal, kcalTarget, lang)}
          />
        )}
        {(totals.protein_g !== null || proteinTarget !== null) && (
          <SummaryStat
            label={
              proteinTarget !== null
                ? t(lang, "nutriClient.proteinTarget")
                : t(lang, "nutriClient.protein")
            }
            value={targetValue(
              "protein_g",
              totals.protein_g,
              proteinTarget,
              lang,
            )}
          />
        )}
        {totals.carb_g !== null && (
          <SummaryStat
            label={t(lang, "nutriClient.carbs")}
            value={`${formatNutritionForDisplay("carb_g", totals.carb_g, lang)} g`}
          />
        )}
        {totals.fat_g !== null && (
          <SummaryStat
            label={t(lang, "nutriClient.fat")}
            value={`${formatNutritionForDisplay("fat_g", totals.fat_g, lang)} g`}
          />
        )}
      </div>
    </section>
  );
}

function targetValue(
  field: "kcal" | "protein_g",
  value: number | null,
  target: number | null,
  lang: Lang,
) {
  const unit = field === "kcal" ? t(lang, "nutriClient.kcal") : "g";
  if (value !== null && target !== null) {
    return `${formatNutritionForDisplay(field, value, lang)} / ${formatNutritionForDisplay(field, target, lang)} ${unit}`;
  }
  const single = value ?? target;
  return single === null
    ? "—"
    : `${formatNutritionForDisplay(field, single, lang)} ${unit}`;
}

function itemPortionLabel(item: MealItem, lang: Lang): string | null {
  if (item.quantity !== null && item.unit !== null) {
    return formatNutritionPortion(item.quantity, item.unit, lang);
  }
  return legacyPortionFallback(item);
}

function localizedItemName(item: MealItem, lang: Lang) {
  if (!item.food_library) return item.name;
  if (lang === "tr" && item.food_library.name_tr?.trim()) {
    return item.food_library.name_tr;
  }
  return item.food_library.name || item.name;
}

function InlineTotals({ totals, lang }: { totals: NutritionTotals; lang: Lang }) {
  return (
    <div className="flex max-w-full flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">
        {totals.isComplete
          ? t(lang, "nutriClient.mealTotal")
          : t(lang, "nutriClient.trackedTotal")}
      </span>
      {totals.kcal !== null && (
        <span>
          {formatNutritionForDisplay("kcal", totals.kcal, lang)}{" "}
          {t(lang, "nutriClient.kcal")}
        </span>
      )}
      {totals.protein_g !== null && (
        <span>
          {t(lang, "nutriClient.proteinShort")}{" "}
          {formatNutritionForDisplay("protein_g", totals.protein_g, lang)} g
        </span>
      )}
      {totals.carb_g !== null && (
        <span>
          {t(lang, "nutriClient.carbsShort")}{" "}
          {formatNutritionForDisplay("carb_g", totals.carb_g, lang)} g
        </span>
      )}
      {totals.fat_g !== null && (
        <span>
          {t(lang, "nutriClient.fatShort")}{" "}
          {formatNutritionForDisplay("fat_g", totals.fat_g, lang)} g
        </span>
      )}
    </div>
  );
}

function ItemMacros({
  values,
  lang,
}: {
  values: NutritionValues;
  lang: Lang;
}) {
  const entries: Array<{
    field: NutritionField;
    label: string;
    suffix: string;
  }> = [
    {
      field: "kcal",
      label: "",
      suffix: ` ${t(lang, "nutriClient.kcal")}`,
    },
    {
      field: "protein_g",
      label: `${t(lang, "nutriClient.proteinShort")} `,
      suffix: " g",
    },
    {
      field: "carb_g",
      label: `${t(lang, "nutriClient.carbsShort")} `,
      suffix: " g",
    },
    {
      field: "fat_g",
      label: `${t(lang, "nutriClient.fatShort")} `,
      suffix: " g",
    },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
      {entries.map(({ field, label, suffix }) => {
        const value = values[field];
        return value === null ? null : (
          <span key={field}>
            {label}
            {formatNutritionForDisplay(field, value, lang)}
            {suffix}
          </span>
        );
      })}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-pill px-3.5 py-3">
      <p className="break-words text-[11px] text-subtle-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
