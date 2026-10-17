import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import type { ClientProgram, ProgramDay } from "@/lib/types";
import { bucketForMonthStart } from "@/lib/month";
import { isReviewDue, reviewContext } from "@/lib/reviews";
import { getLang } from "@/lib/i18n-server";
import type { ExerciseWithVideo } from "@/lib/program-detail";
import { DASHBOARD_BASE } from "@/lib/client-view";
import ProgrammeDetailContent from "./programme-detail-content";


export const metadata: Metadata = {
  title: `Program · ${BRAND_NAME}`,
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
  const badge = bucketForMonthStart(program.month_start_date, context.now, context.timeZone);
  const items = exercises ?? [];
  const dayList = dayRows ?? [];

  const reviewed = context.reviewedPrograms.has(program.id);
  const reviewable = reviewed || isReviewDue(program.month_start_date, context.now, context.timeZone);

  return (
    <ProgrammeDetailContent
      lang={lang}
      program={program}
      items={items}
      dayList={dayList}
      badge={badge}
      reviewed={reviewed}
      reviewable={reviewable}
      base={DASHBOARD_BASE}
      readOnly={false}
    />
  );
}
