"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReviewExerciseRef, ReviewProgramRef } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Runs as the signed-in user; RLS scopes every write to their own rows. */
async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/** Upsert the signed-in user's review for one week (one row per user+week). */
export async function submitReview(input: {
  weekStart: string;
  daysAttended: string;
  programsDone: ReviewProgramRef[];
  hardExercises: ReviewExerciseRef[];
  note: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) {
    return { ok: false, error: "Invalid week." };
  }

  const daysRaw = input.daysAttended.trim();
  let daysAttended: number | null = null;
  if (daysRaw !== "") {
    const n = Number(daysRaw);
    if (Number.isFinite(n)) daysAttended = Math.max(0, Math.min(7, Math.round(n)));
  }

  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      user_id: userId,
      week_start: input.weekStart,
      days_attended: daysAttended,
      programs_done: input.programsDone,
      hard_exercises: input.hardExercises,
      note: input.note.trim() || null,
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) return { ok: false, error: error.message };

  // Resolve the "weekly review is ready" nudge for that week.
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("dedupe_key", `weekly_review:${input.weekStart}`);

  revalidatePath("/dashboard/review");
  revalidatePath("/dashboard");
  return { ok: true };
}
