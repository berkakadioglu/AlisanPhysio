import { t, type Lang } from "@/lib/i18n";
import type { ProgramWithCount } from "@/lib/dashboard-data";
import type { Bucket } from "@/lib/month";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import ProgramList from "./program-list";

/**
 * The programme list: this month, upcoming and past groups. Shared by the
 * client's own programme page and the staff "view as client" preview; `readOnly`
 * drops the review actions and `base` sets each card's link prefix.
 */
export default function ProgrammeContent({
  lang,
  buckets,
  reviewedPrograms,
  base,
  readOnly,
}: {
  lang: Lang;
  buckets: Record<Bucket, ProgramWithCount[]>;
  reviewedPrograms: Set<string>;
  base: string;
  readOnly: boolean;
}) {
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
              review={readOnly ? undefined : group.review}
              base={base}
              readOnly={readOnly}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
