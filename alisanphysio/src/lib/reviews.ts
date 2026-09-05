import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { programTimeZone } from "@/lib/month";
export { isReviewDue } from "@/lib/month";
/** One request-local clock and timezone shared by review prompts and badges. */
export const reviewContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { reviewedPrograms: new Set<string>(), timeZone: programTimeZone(), now: new Date() };
  const [reviews, profile] = await Promise.all([
    supabase.from("program_reviews").select("program_id, programs!inner(kind)").eq("client_id", user.id).eq("programs.kind", "client"),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  if (reviews.error) throw new Error("Could not load programme reviews");
  return { reviewedPrograms: new Set((reviews.data ?? []).map((r) => r.program_id as string)), timeZone: programTimeZone(profile.data?.timezone), now: new Date() };
});
export async function reviewedProgramSet(): Promise<Set<string>> { return (await reviewContext()).reviewedPrograms; }
