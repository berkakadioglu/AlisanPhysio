"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { isReviewDue, daysInMonth } from "@/lib/month";
import type { ReviewExerciseRef, ReviewProgramRef, ClientProgram } from "@/lib/types";
export async function submitReview(input: {
  programId: string; daysAttended: string; programsDone: ReviewProgramRef[];
  hardExercises: ReviewExerciseRef[]; note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const fail = (key: string) => ({ ok: false as const, error: t(lang, key) });
  if (!/^[0-9a-f-]{36}$/i.test(input.programId)) return fail("err.reviewNoPrograms");
  const [programResult, profile, existing] = await Promise.all([
    supabase.from("programs").select("*").eq("kind", "client").eq("client_id", user.id).eq("id", input.programId).maybeSingle<ClientProgram>(),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
    supabase.from("program_reviews").select("id").eq("client_id", user.id).eq("program_id", input.programId).maybeSingle(),
  ]);
  if (programResult.error || profile.error || existing.error) return fail("err.reviewSave");
  const program = programResult.data;
  if (!program) return fail("err.reviewNoPrograms");
  if (existing.data) return fail("err.reviewAlreadySubmitted");
  if (!isReviewDue(program.month_start_date, new Date(), profile.data?.timezone)) return fail("review.notDue");
  const days = input.daysAttended.trim() === "" ? null : Number(input.daysAttended);
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > daysInMonth(program.month_start_date))) return fail("err.reviewDays");
  if (input.note.length > 4000 || !Array.isArray(input.programsDone) || !Array.isArray(input.hardExercises)) return fail("err.reviewSave");
  // Resolve selected labels server-side: callers cannot invent foreign snapshots.
  const { data: exercises, error: exerciseError } = await supabase.from("exercises").select("id, name").eq("program_id", program.id);
  if (exerciseError) return fail("err.reviewSave");
  const names = new Map((exercises ?? []).map((ex) => [ex.id as string, ex.name as string]));
  if (input.programsDone.some((p) => p.id !== program.id) || input.hardExercises.some((ex) => !names.has(ex.id))) return fail("err.reviewSelection");
  const { error } = await supabase.from("program_reviews").insert({
    client_id: user.id, program_id: program.id, days_attended: days,
    programs_done: input.programsDone.length ? [{ id: program.id, title: program.title }] : [],
    hard_exercises: [...new Set(input.hardExercises.map((ex) => ex.id))].map((id) => ({ id, name: names.get(id) })),
    note: input.note.trim() || null,
  });
  if (error) return fail(error.code === "23505" ? "err.reviewAlreadySubmitted" : error.message.includes("review_not_due") ? "review.notDue" : "err.reviewSave");
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("dedupe_key", `program_review:${program.id}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/admin/clients/${user.id}`);
  return { ok: true };
}
