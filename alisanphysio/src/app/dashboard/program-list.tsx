import ProgramCard from "./program-card";
import { type ProgramWithCount, dayTitlesOf } from "@/lib/dashboard-data";

/** Responsive grid of compact program cards, with a gentle empty state. */
export default function ProgramList({
  programs,
  empty,
}: {
  programs: ProgramWithCount[];
  empty: string;
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
        <ProgramCard
          key={program.id}
          id={program.id}
          title={program.title}
          weekStartDate={program.week_start_date}
          notes={program.notes}
          exerciseCount={program.exercises[0]?.count ?? 0}
          dayTitles={dayTitlesOf(program)}
        />
      ))}
    </div>
  );
}
