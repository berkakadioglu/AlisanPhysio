import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";
import { loadDashboardData } from "@/lib/dashboard-data";
import { reviewedProgramSet } from "@/lib/reviews";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ProgramList from "../program-list";

export const metadata: Metadata = {
  title: `Past programs · ${BRAND_NAME}`,
};

export default async function PastProgramsPage() {
  const { buckets } = await loadDashboardData();
  const lang = await getLang();
  const reviewedPrograms = await reviewedProgramSet();

  return (
      <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "list.backToThisMonth")}
        </Link>

        <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {t(lang, "list.pastTitle")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t(lang, "list.pastSubtitle")}
        </p>

        <div className="mt-8">
          <ProgramList
            programs={buckets.past}
            empty={t(lang, "list.emptyPast")}
            review={{ lang, reviewedPrograms }}
          />
        </div>
      </main>
  );
}
