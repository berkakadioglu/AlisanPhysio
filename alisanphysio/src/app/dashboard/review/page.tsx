import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { formatWeekRange, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { prevMondayISO } from "@/lib/program-dates";
import AppHeader from "../app-header";
import ReviewForm, { type ReviewProgram } from "./review-form";

export const metadata: Metadata = {
  title: `Weekly review · ${BRAND_NAME}`,
};

type ProgramRow = {
  id: string;
  title: string;
  program_days: { id: string; title: string | null; order_index: number }[];
  exercises: { id: string; name: string; order_index: number; day_id: string | null }[];
};

type ReviewRow = {
  days_attended: number | null;
  programs_done: { id: string }[];
  hard_exercises: { id: string }[];
  note: string | null;
};

export default async function WeeklyReviewPage() {
  const supabase = await createClient();
  const lang = await getLang();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekStart = prevMondayISO();

  // Last week's programs for THIS user (own only — explicit filter; RLS would
  // let staff read all otherwise).
  const { data: rows } = await supabase
    .from("programs")
    .select(
      "id, title, program_days(id, title, order_index), exercises(id, name, order_index, day_id)",
    )
    .eq("client_id", user.id)
    .eq("week_start_date", weekStart)
    .returns<ProgramRow[]>();

  const programs: ReviewProgram[] = (rows ?? []).map((p) => {
    const days = [...(p.program_days ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    );
    const byOrder = (a: { order_index: number }, b: { order_index: number }) =>
      a.order_index - b.order_index;
    const dayList = days.map((d) => ({
      title: d.title,
      exercises: p.exercises
        .filter((e) => e.day_id === d.id)
        .sort(byOrder)
        .map((e) => ({ id: e.id, name: e.name })),
    }));
    const orphans = p.exercises
      .filter((e) => !days.some((d) => d.id === e.day_id))
      .sort(byOrder)
      .map((e) => ({ id: e.id, name: e.name }));
    if (orphans.length > 0) dayList.push({ title: null, exercises: orphans });
    return { id: p.id, title: p.title, days: dayList };
  });

  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("days_attended, programs_done, hard_exercises, note")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle<ReviewRow>();

  return (
    <div className="min-h-screen">
      <AppHeader container="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "prog.back")}
        </Link>

        <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {t(lang, "review.heading")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t(lang, "review.subtitle", {
            range: formatWeekRange(weekStart, lang),
          })}
        </p>

        <div className="mt-8">
          {programs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center text-sm text-subtle-foreground">
              {t(lang, "review.none")}
            </p>
          ) : (
            <ReviewForm
              weekStart={weekStart}
              programs={programs}
              initialDays={existing?.days_attended != null ? String(existing.days_attended) : ""}
              initialDone={(existing?.programs_done ?? []).map((p) => p.id)}
              initialHard={(existing?.hard_exercises ?? []).map((e) => e.id)}
              initialNote={existing?.note ?? ""}
              isEdit={!!existing}
            />
          )}
        </div>
      </main>
    </div>
  );
}
