import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { programTimeZone } from "@/lib/month";
export { isReviewDue } from "@/lib/month";

export interface ReviewContext {
  reviewedPrograms: Set<string>;
  timeZone: string;
  now: Date;
}

/** Reviewed-programme ids, timezone and clock for one client (staff pass the client they view). */
export async function reviewContextFor(supabase: SupabaseClient, clientId: string): Promise<ReviewContext> {
  const [reviews, profile] = await Promise.all([
    supabase.from("program_reviews").select("program_id, programs!inner(kind)").eq("client_id", clientId).eq("programs.kind", "client"),
    supabase.from("profiles").select("timezone").eq("id", clientId).maybeSingle(),
  ]);
  if (reviews.error) throw new Error("Could not load programme reviews");
  return { reviewedPrograms: new Set((reviews.data ?? []).map((r) => r.program_id as string)), timeZone: programTimeZone(profile.data?.timezone), now: new Date() };
}

/** One request-local clock and timezone shared by review prompts and badges. */
export const reviewContext = cache(async (): Promise<ReviewContext> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { reviewedPrograms: new Set<string>(), timeZone: programTimeZone(), now: new Date() };
  return reviewContextFor(supabase, user.id);
});
export async function reviewedProgramSet(): Promise<Set<string>> { return (await reviewContext()).reviewedPrograms; }
