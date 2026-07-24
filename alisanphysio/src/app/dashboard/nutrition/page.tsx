import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { loadNutritionPlan } from "@/lib/nutrition";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import AppHeader from "../app-header";

export const metadata: Metadata = {
  title: `Nutrition · ${BRAND_NAME}`,
};

export default async function ClientNutritionPage() {
  const supabase = await createClient();
  const lang = await getLang();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS scopes the plan (and its meals/items) to the signed-in user only.
  const plan = await loadNutritionPlan(supabase, user.id);
  const meals = plan?.meals ?? [];

  return (
    <div className="min-h-screen">
      <AppHeader container="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "prog.back")}
        </Link>

        <h1 className="mt-5 font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
          {t(lang, "nutriClient.heading")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t(lang, "nutriClient.subtitle")}
        </p>

        {plan?.notes && (
          <div className="mt-7 rounded-2xl bg-brand-tint p-5 sm:p-6">
            <p className="text-sm font-semibold text-brand">
              {t(lang, "nutriClient.notesFrom")}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
              {plan.notes}
            </p>
          </div>
        )}

        {!plan || meals.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center">
            <p className="font-display text-lg font-bold text-foreground">
              {t(lang, "nutriClient.emptyFull")}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t(lang, "nutriClient.emptyFullHint")}
            </p>
          </div>
        ) : (
          <div className="mt-9 space-y-9">
            {meals.map((meal) => (
              <section key={meal.id}>
                <h2 className="mb-4 font-display text-lg font-bold text-foreground">
                  {meal.title}
                </h2>
                {meal.items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-surface/40 px-5 py-6 text-center text-sm text-subtle-foreground">
                    —
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {meal.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl bg-surface p-4 shadow-soft sm:p-5"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="text-base font-semibold text-foreground">
                            {item.name}
                          </h3>
                          {item.portion && (
                            <span className="text-sm font-semibold text-brand-bright">
                              {item.portion}
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {item.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
