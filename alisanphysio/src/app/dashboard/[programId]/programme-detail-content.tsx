import Link from "next/link";
import { formatMonth, t, type Lang } from "@/lib/i18n";
import type { Bucket } from "@/lib/month";
import type { ClientProgram, ProgramDay } from "@/lib/types";
import { titleIsMonth, trainingDays, type ExerciseWithVideo } from "@/lib/program-detail";
import { isRichTextEmpty } from "@/lib/rich-text";
import RichText from "@/components/rich-text";
import ReviewAction from "../review-action";
import ProgramDays from "./program-days";

const BADGE: Record<Bucket, { key: string; className: string }> = {
  current: { key: "dash.thisMonth", className: "bg-brand-tint text-brand" },
  upcoming: { key: "bucket.upcoming", className: "bg-pill text-muted-foreground" },
  past: { key: "bucket.past", className: "bg-pill text-subtle-foreground" },
};

/**
 * One programme's detail page. Shared by the client's own programme route and the
 * staff "view as client" preview; `readOnly` hides the review action and `base`
 * sets the back link.
 */
export default function ProgrammeDetailContent({
  lang,
  program,
  items,
  dayList,
  badge,
  reviewed,
  reviewable,
  base,
  readOnly,
}: {
  lang: Lang;
  program: ClientProgram;
  items: ExerciseWithVideo[];
  dayList: ProgramDay[];
  badge: Bucket;
  reviewed: boolean;
  reviewable: boolean;
  base: string;
  readOnly: boolean;
}) {
  const badgeStyle = BADGE[badge];
  const sections = trainingDays(dayList, items, lang);
  const monthLabel = formatMonth(program.month_start_date, lang);
  const monthOnlyTitle = titleIsMonth(program.title, program.month_start_date);

  return (
      <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
        <Link
          href={base}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "prog.back")}
        </Link>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-brand">{t(lang, "dash.programmeEyebrow")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">
            {monthOnlyTitle ? monthLabel : program.title}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${badgeStyle.className}`}
          >
            {t(lang, badgeStyle.key)}
          </span>
        </div>
        {!monthOnlyTitle && <p className="mt-2 text-base text-muted-foreground">{monthLabel}</p>}

        {!isRichTextEmpty(program.notes) && (
          <div className="mt-7 min-w-0 rounded-2xl bg-brand-tint p-5 sm:p-6">
            <p className="text-sm font-semibold text-brand">
              {t(lang, "prog.notesFrom")}
            </p>
            <RichText value={program.notes} className="mt-1.5 text-foreground/80" />
          </div>
        )}

        {!readOnly && reviewable && items.length > 0 && (
          <div className="mt-8">
            <ReviewAction
              programId={program.id}
              monthStartDate={program.month_start_date}
              reviewed={reviewed}
              lang={lang}
              block
            />
          </div>
        )}

        {items.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 px-5 py-10 text-center text-sm text-subtle-foreground">{t(lang, "prog.noExercises")}</p>
        ) : <ProgramDays key={program.id} programId={program.id} days={sections} lang={lang} />}

      </main>
  );
}
