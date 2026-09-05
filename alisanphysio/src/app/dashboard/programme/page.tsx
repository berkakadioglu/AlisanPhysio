import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/constants";
import { loadDashboardData } from "@/lib/dashboard-data";
import { reviewedProgramSet } from "@/lib/reviews";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import ProgramList from "../program-list";

export const metadata: Metadata = {
  title: `Programme · ${BRAND_NAME}`,
};

export default async function ProgrammePage() {
  const { buckets } = await loadDashboardData();
  const lang = await getLang();
  const reviewedPrograms = await reviewedProgramSet();

  const groups = [
    {
      id: "current-programmes",
      label: t(lang, "dash.thisMonth"),
      programs: buckets.current,
      empty: t(lang, "dash.noThisMonthBody"),
      review: { lang, reviewedPrograms },
    },
    {
      id: "upcoming-programmes",
      label: t(lang, "list.upcomingTitle"),
      programs: buckets.upcoming,
      empty: t(lang, "list.emptyUpcoming"),
      review: undefined,
    },
    {
      id: "past-programmes",
      label: t(lang, "list.pastTitle"),
      programs: buckets.past,
      empty: t(lang, "list.emptyPast"),
      review: { lang, reviewedPrograms },
    },
  ];

  return (
    <main id="main-content" className="min-w-0">
      <DashboardSectionIntro
        eyebrow={t(lang, "dash.programmeEyebrow")}
        title={t(lang, "dash.programmeTitle")}
        body={t(lang, "dash.programmeBody")}
      />

      <div className="mt-7 space-y-8">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={group.id} className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 id={group.id} className="font-display text-lg font-bold text-foreground">
                {group.label}
              </h2>
              <span className="rounded-full bg-pill px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                {group.programs.length}
              </span>
            </div>
            <ProgramList
              programs={group.programs}
              empty={group.empty}
              review={group.review}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
