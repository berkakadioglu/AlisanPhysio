import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ClientProgram } from "@/lib/types";
import { bucketForMonthStart, type Bucket } from "@/lib/month";

/** Program row plus embedded exercise count and its days (for the summary). */
export type ProgramWithCount = ClientProgram & {
  exercises: { count: number }[];
  program_days: { title: string | null; order_index: number }[];
};

/** Ordered day titles ("" for untitled) for a program's summary line. */
export function dayTitlesOf(program: ProgramWithCount): string[] {
  return [...(program.program_days ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((d) => d.title ?? "");
}

export interface DashboardData {
  profile: Profile | null;
  buckets: Record<Bucket, ProgramWithCount[]>;
}

/**
 * Shared loader for the dashboard family of pages (This month / Past / Upcoming).
 * Auth guard + data fetching + bucketing are identical to what the single
 * dashboard page used before — just extracted so the three routes reuse it.
 * RLS still scopes every row to the signed-in client.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy already guards these routes, but never trust a single auth layer.
  if (!user) {
    redirect("/login");
  }

  return loadClientDashboardData(supabase, user.id);
}

/**
 * The dashboard data for one client id. The signed-in client passes their own id;
 * the staff "view as client" pages pass the client being viewed. Every query is
 * scoped to clientId explicitly, because staff can read every row via RLS.
 */
export async function loadClientDashboardData(
  supabase: SupabaseClient,
  clientId: string,
): Promise<DashboardData> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, timezone, nutrition_enabled")
    .eq("id", clientId)
    .single<Profile>();

  // Scope to the client's OWN programs. Staff (admin/manager) can read every
  // program via RLS, so the dashboard MUST filter explicitly — otherwise a staff
  // member's own dashboard would show everyone's programs.
  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select(
      "id, kind, client_id, title, month_start_date, notes, created_at, exercises(count), program_days(title, order_index)",
    )
    .eq("kind", "client")
    .eq("client_id", clientId)
    .order("month_start_date", { ascending: false })
    .returns<ProgramWithCount[]>();

  if (programsError) throw new Error("Could not load programmes");
  const rows = programs ?? [];

  const buckets: Record<Bucket, ProgramWithCount[]> = {
    past: [],
    current: [],
    upcoming: [],
  };
  for (const program of rows) {
    buckets[bucketForMonthStart(program.month_start_date, new Date(), profile?.timezone)].push(program);
  }
  // Upcoming reads best soonest-first; past/current stay most-recent-first.
  buckets.upcoming.reverse();

  return { profile, buckets };
}

/** First name for greetings, or null when we have no name to show. */
export function firstNameOf(profile: Profile | null): string | null {
  return profile?.full_name?.trim()
    ? profile.full_name.trim().split(" ")[0]
    : null;
}
