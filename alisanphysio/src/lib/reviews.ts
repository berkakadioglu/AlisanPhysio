import { createClient } from "@/lib/supabase/server";
import { bucketForWeekStart } from "@/lib/week";

/**
 * The set of week_start values (YYYY-MM-DD) the signed-in user has a weekly
 * review for. Used to show "Add review" vs "Review submitted" inline on the
 * relevant program cards.
 *
 * Explicitly scoped to the caller's own rows: staff can read ALL reviews via
 * RLS, so the filter by auth.uid() is required for a correct personal view.
 */
export async function reviewedWeekSet(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("weekly_reviews")
    .select("week_start")
    .eq("user_id", user.id);

  return new Set((data ?? []).map((r) => r.week_start as string));
}

/** A program week is reviewable when it's the current week or a past week. */
export function isReviewableWeek(weekStartIso: string): boolean {
  return bucketForWeekStart(weekStartIso) !== "upcoming";
}
