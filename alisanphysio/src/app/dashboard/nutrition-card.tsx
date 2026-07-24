import Link from "next/link";
import { Apple } from "lucide-react";
import { mealsCount, t, type Lang } from "@/lib/i18n";

/**
 * Small, understated nutrition entry point on the client dashboard. Deliberately
 * NOT equal-weight with the program hero — Alişan often won't set a nutrition
 * plan, so the empty state stays muted and quiet rather than a big empty hero.
 */
export default function NutritionCard({
  hasPlan,
  mealCount,
  lang,
}: {
  hasPlan: boolean;
  mealCount: number;
  lang: Lang;
}) {
  if (!hasPlan) {
    // Muted, dimmed "no plan yet" state — present but doesn't draw attention.
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-3.5 opacity-70">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-pill text-subtle-foreground">
          <Apple className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {t(lang, "nutriClient.card")}
          </p>
          <p className="truncate text-xs text-subtle-foreground">
            {t(lang, "nutriClient.empty")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/dashboard/nutrition"
      className="group flex items-center gap-3 rounded-2xl border border-border bg-surface/60 px-4 py-3.5 transition hover:border-brand/30 hover:bg-surface"
    >
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
        <Apple className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground transition group-hover:text-brand">
          {t(lang, "nutriClient.card")}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {mealsCount(lang, mealCount)}
        </p>
      </div>
      <span
        aria-hidden
        className="ml-auto text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
      >
        →
      </span>
    </Link>
  );
}
