import ProgramCard from "./program-card";
import ReviewAction from "./review-action";
import { type ProgramWithCount, dayTitlesOf } from "@/lib/dashboard-data";
import type { Lang } from "@/lib/i18n";

/**
 * Responsive grid of compact program cards, with a gentle empty state.
 * When `review` is passed (submitted reviews remain visible), each card gets an
 * inline "Add review" / "Review submitted" action beneath it. `readOnly` (the
 * staff preview) never renders that action, and `base` sets each card's link prefix.
 */
export default function ProgramList({
  programs,
  empty,
  review,
  base = "/dashboard",
  readOnly = false,
}: {
  programs: ProgramWithCount[];
  empty: string;
  review?: { lang: Lang; reviewedPrograms: Set<string> };
  base?: string;
  readOnly?: boolean;
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
            href={`${base}/${program.id}`}
            title={program.title}
            monthStartDate={program.month_start_date}
            notes={program.notes}
            exerciseCount={program.exercises[0]?.count ?? 0}
            dayTitles={dayTitlesOf(program)}
            dayChips
          />
          {review && !readOnly && (
            <div className="px-1">
              <ReviewAction
                programId={program.id}
                monthStartDate={program.month_start_date}
                reviewed={review.reviewedPrograms.has(program.id)}
                lang={review.lang}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
