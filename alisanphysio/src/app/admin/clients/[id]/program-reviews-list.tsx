import { daysCount, formatMonth, t, type Lang } from "@/lib/i18n";
import type { ProgramReview } from "@/lib/types";

/**
 * Read-only staff view of a user's submitted monthly reviews (newest first).
 * Pure presentational — renders inside the admin detail server component.
 */
export default function ProgramReviewsList({
  reviews,
  lang,
}: {
  reviews: ProgramReview[];
  lang: Lang;
}) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-subtle-foreground">
        {t(lang, "review.staffEmpty")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => {
        const programs = (r.programs_done ?? []).map((p) => p.title).filter(Boolean);
        const hard = (r.hard_exercises ?? []).map((e) => e.name).filter(Boolean);
        return (
          <div
            key={r.id}
            className="rounded-2xl border border-border bg-surface/60 p-5 shadow-soft"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-sm font-bold text-foreground">
                {r.programs ? formatMonth(r.programs.month_start_date, lang) : t(lang, "review.heading")}
              </p>
              {r.days_attended != null && (
                <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {t(lang, "review.daysLabel")}: {daysCount(lang, r.days_attended)}
                </span>
              )}
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <Row label={t(lang, "review.programsLabel")}>
                {programs.length > 0 ? programs.join(", ") : t(lang, "review.nonePicked")}
              </Row>
              <Row label={t(lang, "review.hardLabel")}>
                {hard.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {hard.map((name, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-pill px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </span>
                ) : (
                  t(lang, "review.nonePicked")
                )}
              </Row>
              {r.note && <Row label={t(lang, "review.noteLabel")}>{r.note}</Row>}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 flex-none text-xs font-semibold uppercase tracking-wide text-subtle-foreground sm:pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-foreground">{children}</dd>
    </div>
  );
}
