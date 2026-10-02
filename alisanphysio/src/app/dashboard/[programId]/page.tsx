import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import type { ClientProgram, ProgramDay } from "@/lib/types";
import { bucketForMonthStart, type Bucket } from "@/lib/month";
import { isReviewDue, reviewContext } from "@/lib/reviews";
import { formatMonth, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { trainingDays, titleIsMonth, type ExerciseWithVideo } from "@/lib/program-detail";
import { isRichTextEmpty } from "@/lib/rich-text";
import RichText from "@/components/rich-text";
import ReviewAction from "../review-action";
import ProgramDays from "./program-days";


export const metadata: Metadata = {
  title: `Program · ${BRAND_NAME}`,
};

const BADGE: Record<Bucket, { key: string; className: string }> = {
  current: { key: "dash.thisMonth", className: "bg-brand-tint text-brand" },
  upcoming: { key: "bucket.upcoming", className: "bg-pill text-muted-foreground" },
  past: { key: "bucket.past", className: "bg-pill text-subtle-foreground" },
};

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const supabase = await createClient();
  const lang = await getLang();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS guarantees a client can only read a program that is theirs; anything
  // else comes back empty → 404.
  const { data: program } = await supabase
    .from("programs")
    .select("id, kind, client_id, title, month_start_date, notes, created_at")
    .eq("kind", "client")
    .eq("id", programId)
    .eq("client_id", user.id)
    .maybeSingle<ClientProgram>();

  if (!program) {
    notFound();
  }

  const [{ data: exercises }, { data: dayRows }] = await Promise.all([
    supabase
      .from("exercises")
      .select(
        "id, program_id, name, sets, reps, instructions, media_url, order_index, library_id, day_id, exercise_library(youtube_url)",
      )
      .eq("program_id", program.id)
      .order("order_index", { ascending: true })
      .returns<ExerciseWithVideo[]>(),
    supabase
      .from("program_days")
      .select("id, program_id, title, order_index, created_at")
      .eq("program_id", program.id)
      .order("order_index", { ascending: true })
      .returns<ProgramDay[]>(),
  ]);

  const context = await reviewContext();
  const badge = BADGE[bucketForMonthStart(program.month_start_date, context.now, context.timeZone)];
  const items = exercises ?? [];
  const dayList = dayRows ?? [];

  const reviewed = context.reviewedPrograms.has(program.id);
  const reviewable = reviewed || isReviewDue(program.month_start_date, context.now, context.timeZone);

  const sections = trainingDays(dayList, items, lang);
  const monthLabel = formatMonth(program.month_start_date, lang);
  const monthOnlyTitle = titleIsMonth(program.title, program.month_start_date);

  return (
      <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
        <Link
          href="/dashboard"
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
            className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}
          >
            {t(lang, badge.key)}
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

        {reviewable && items.length > 0 && (
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
