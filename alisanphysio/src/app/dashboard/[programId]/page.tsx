import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import type { Exercise, Program, ProgramDay } from "@/lib/types";
import { bucketForWeekStart, type Bucket } from "@/lib/week";
import { isReviewableWeek } from "@/lib/reviews";
import { formatWeekRange, t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { parseYouTubeId } from "@/lib/youtube";
import ReviewAction from "../review-action";
import YouTubeEmbed from "@/components/youtube-embed";

/** Exercise plus the embedded library video (if it's linked to one). */
type ExerciseWithVideo = Exercise & {
  exercise_library: { youtube_url: string | null } | null;
};

export const metadata: Metadata = {
  title: `Program · ${BRAND_NAME}`,
};

const BADGE: Record<Bucket, { key: string; className: string }> = {
  current: { key: "dash.thisWeek", className: "bg-brand-tint text-brand" },
  upcoming: { key: "bucket.upcoming", className: "bg-pill text-muted-foreground" },
  past: { key: "bucket.past", className: "bg-pill text-subtle-foreground" },
};

/** Localized "3 sets × 10-12" / "30 sec hold" summary line. */
function effortLine(ex: Exercise, lang: Lang): string | null {
  const hasSets = ex.sets != null;
  const hasReps = ex.reps != null && ex.reps.trim() !== "";
  if (hasSets && hasReps)
    return t(lang, "effort.setsReps", { sets: ex.sets!, reps: ex.reps!.trim() });
  if (hasSets) return t(lang, "effort.sets", { sets: ex.sets! });
  if (hasReps) return ex.reps!.trim();
  return null;
}

function ExerciseItem({
  ex,
  index,
  lang,
}: {
  ex: ExerciseWithVideo;
  index: number;
  lang: Lang;
}) {
  const effort = effortLine(ex, lang);
  const videoSource = ex.exercise_library?.youtube_url ?? ex.media_url;
  const videoId = parseYouTubeId(videoSource);

  return (
    <li className="rounded-2xl bg-surface p-4 shadow-soft sm:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-pill text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-base font-semibold text-foreground">{ex.name}</h3>
            {effort && (
              <span className="text-sm font-semibold text-brand-bright tabular-nums">
                {effort}
              </span>
            )}
          </div>
          {ex.instructions && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {ex.instructions}
            </p>
          )}
          {videoId ? (
            <div className="mt-3">
              <YouTubeEmbed id={videoId} title={ex.name} />
            </div>
          ) : (
            ex.media_url && (
              <a
                href={ex.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-bright transition hover:text-brand-hover"
              >
                {t(lang, "prog.watchDemo")} <span aria-hidden>↗</span>
              </a>
            )
          )}
        </div>
      </div>
    </li>
  );
}

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
    .select("id, client_id, title, week_start_date, notes, created_at")
    .eq("id", programId)
    .maybeSingle<Program>();

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

  const badge = BADGE[bucketForWeekStart(program.week_start_date)];
  const items = exercises ?? [];
  const dayList = dayRows ?? [];

  // Inline review affordance: current/past weeks are reviewable, future aren't.
  const reviewable = isReviewableWeek(program.week_start_date);
  let reviewed = false;
  if (reviewable) {
    const { data: rev } = await supabase
      .from("weekly_reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", program.week_start_date)
      .maybeSingle();
    reviewed = !!rev;
  }

  // Flat when there are no days, or a single untitled day. Grouped otherwise.
  const grouped =
    dayList.length > 1 || dayList.some((d) => (d.title ?? "").trim() !== "");

  const byOrder = (a: ExerciseWithVideo, b: ExerciseWithVideo) =>
    a.order_index - b.order_index;

  const sections = dayList.map((d, i) => ({
    heading: (d.title ?? "").trim() || t(lang, "prog.day", { n: i + 1 }),
    exercises: items.filter((e) => e.day_id === d.id).sort(byOrder),
  }));
  const orphans = items
    .filter((e) => !dayList.some((d) => d.id === e.day_id))
    .sort(byOrder);
  if (orphans.length > 0) {
    sections.push({
      heading: t(lang, "prog.day", { n: sections.length + 1 }),
      exercises: orphans,
    });
  }

  return (
      <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "prog.back")}
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
            {program.title}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}
          >
            {t(lang, badge.key)}
          </span>
        </div>
        <p className="mt-2 text-base text-muted-foreground">
          {formatWeekRange(program.week_start_date, lang)}
        </p>

        {program.notes && (
          <div className="mt-7 rounded-2xl bg-brand-tint p-5 sm:p-6">
            <p className="text-sm font-semibold text-brand">
              {t(lang, "prog.notesFrom")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
              {program.notes}
            </p>
          </div>
        )}

        {reviewable && items.length > 0 && (
          <div className="mt-8">
            <ReviewAction
              weekStart={program.week_start_date}
              reviewed={reviewed}
              lang={lang}
              block
            />
          </div>
        )}

        {items.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 px-5 py-10 text-center text-sm text-subtle-foreground">
            {t(lang, "prog.noExercises")}
          </p>
        ) : grouped ? (
          <div className="mt-9 space-y-9">
            {sections.map((sec, si) => (
              <section key={si}>
                <h2 className="mb-4 font-display text-lg font-bold text-foreground">
                  {sec.heading}
                </h2>
                <ol className="space-y-3 sm:space-y-4">
                  {sec.exercises.map((ex, i) => (
                    <ExerciseItem key={ex.id} ex={ex} index={i} lang={lang} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <section className="mt-10">
            <h2 className="mb-4 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t(lang, "prog.exercises")}
            </h2>
            <ol className="space-y-3 sm:space-y-4">
              {[...items].sort(byOrder).map((ex, i) => (
                <ExerciseItem key={ex.id} ex={ex} index={i} lang={lang} />
              ))}
            </ol>
          </section>
        )}
      </main>
  );
}
