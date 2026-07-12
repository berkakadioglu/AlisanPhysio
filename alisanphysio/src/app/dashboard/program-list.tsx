import ProgramCard from "./program-card";
import ReviewAction from "./review-action";
import { type ProgramWithCount, dayTitlesOf } from "@/lib/dashboard-data";
import type { Lang } from "@/lib/i18n";

/**
 * Responsive grid of compact program cards, with a gentle empty state.
 * When `review` is passed (past programs are reviewable), each card gets an
 * inline "Add review" / "Review submitted" action beneath it.
 */
export default function ProgramList({
  programs,
  empty,
  review,
}: {
  programs: ProgramWithCount[];
  empty: string;
  review?: { lang: Lang; reviewedWeeks: Set<string> };
}) {
  if (programs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center text-sm text-subtle-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {programs.map((program) => (
        <div key={program.id} className="space-y-2">
          <ProgramCard
            id={program.id}
            title={program.title}
            weekStartDate={program.week_start_date}
            notes={program.notes}
            exerciseCount={program.exercises[0]?.count ?? 0}
            dayTitles={dayTitlesOf(program)}
          />
          {review && (
            <div className="px-1">
              <ReviewAction
                weekStart={program.week_start_date}
                reviewed={review.reviewedWeeks.has(program.week_start_date)}
                lang={review.lang}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
