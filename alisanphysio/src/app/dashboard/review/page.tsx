import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { formatMonth, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { thisMonthISO, isReviewDue, daysInMonth } from "@/lib/month";
import { reviewContext } from "@/lib/reviews";
import ReviewForm, { type ReviewProgram } from "./review-form";

export const metadata: Metadata = {
  title: `Monthly review · ${BRAND_NAME}`,
};

type ProgramRow = {
  id: string;
  title: string;
  month_start_date: string;
  program_days: { id: string; title: string | null; order_index: number }[];
  exercises: { id: string; name: string; order_index: number; day_id: string | null }[];
};

type ReviewRow = {
  days_attended: number | null;
  programs_done: { id: string; title: string }[];
  hard_exercises: { id: string; name: string }[];
  note: string | null;
};


export default async function ProgramReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const supabase = await createClient();
  const lang = await getLang();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { program: requestedId } = await searchParams;
  const context = await reviewContext();
  let query = supabase.from("programs")
    .select("id, title, month_start_date, program_days(id, title, order_index), exercises(id, name, order_index, day_id)")
    .eq("kind", "client").eq("client_id", user.id);
  query = requestedId ? query.eq("id", requestedId) : query.eq("month_start_date", thisMonthISO(context.now, context.timeZone));
  const { data: rows, error } = await query.returns<ProgramRow[]>();
  if (error) throw new Error("Could not load review programme");
  const selected = rows?.[0];
  const month = selected?.month_start_date ?? thisMonthISO(context.now, context.timeZone);
  const due = !!selected && isReviewDue(month, context.now, context.timeZone);
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

  const { data: existing } = selected ? await supabase.from("program_reviews")
    .select("days_attended, programs_done, hard_exercises, note")
    .eq("client_id", user.id).eq("program_id", selected.id).maybeSingle<ReviewRow>() : { data: null };

  return (
      <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
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
            range: formatMonth(month, lang),
          })}
        </p>

        <div className="mt-8">
          {!selected || (!due && !existing) ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center text-sm text-subtle-foreground">
              {t(lang, selected ? "review.notDue" : "review.none")}
            </p>
          ) : (
            <>
            {existing && <p className="mb-4 font-semibold text-brand">{t(lang, "review.submitted")}</p>}
            <ReviewForm
              programId={selected.id}
              maxDays={daysInMonth(month)}
              programs={existing ? [{ id: selected.id, title: existing.programs_done[0]?.title ?? selected.title, days: [{ title: null, exercises: existing.hard_exercises }] }] : programs}
              initialDays={existing?.days_attended != null ? String(existing.days_attended) : ""}
              initialDone={(existing?.programs_done ?? []).map((p) => p.id)}
              initialHard={(existing?.hard_exercises ?? []).map((e) => e.id)}
              initialNote={existing?.note ?? ""}
              isEdit={!!existing}
            />
            </>
          )}
        </div>
      </main>
  );
}
