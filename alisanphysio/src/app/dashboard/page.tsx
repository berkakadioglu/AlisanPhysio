import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/constants";
import { loadDashboardData, firstNameOf } from "@/lib/dashboard-data";
import { reviewedProgramSet } from "@/lib/reviews";
import { nutritionPlanSummary } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { DASHBOARD_BASE, nextUpcomingAppointment } from "@/lib/client-view";
import type { ClientAppointment } from "@/lib/types";
import OverviewContent from "./overview-content";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "dash.tab.overview")} · ${BRAND_NAME}` };
}

/** One stable clock read for the whole server render. */
function requestTimeMs(): number {
  return Date.now();
}

export default async function DashboardPage() {
  const { profile, buckets } = await loadDashboardData();

  const firstName = firstNameOf(profile);
  const lang = await getLang();
  const reviewedPrograms = await reviewedProgramSet();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = requestTimeMs();

  const [nutrition, appointmentResult, measurementResult, timezoneResult] = user
    ? await Promise.all([
        profile?.nutrition_enabled ? nutritionPlanSummary(supabase, user.id) : Promise.resolve({ hasPlan: false, mealCount: 0 }),
        supabase
          .rpc("get_own_appointments", {
            p_from: new Date(now - 24 * 60 * 60 * 1_000).toISOString(),
            p_to: null,
          }),
        supabase
          .from("measurements")
          .select("id", { count: "exact", head: true })
          .eq("client_id", user.id),
        supabase
          .from("profiles")
          .select("timezone")
          .eq("id", user.id)
          .maybeSingle<{ timezone: string | null }>(),
      ])
    : [
        { hasPlan: false, mealCount: 0 },
        { data: [] as ClientAppointment[] },
        { count: 0 },
        { data: null as { timezone: string | null } | null },
      ];

  const appointments = Array.isArray(appointmentResult.data)
    ? (appointmentResult.data as ClientAppointment[])
    : [];
  const nextAppointment = nextUpcomingAppointment(appointments, now);
  const storedTimeZone = timezoneResult.data?.timezone ?? null;
  const measurementCount = measurementResult.count ?? 0;

  return (
    <OverviewContent
      lang={lang}
      firstName={firstName}
      buckets={buckets}
      nutritionEnabled={Boolean(profile?.nutrition_enabled)}
      mealCount={nutrition.mealCount}
      nextAppointment={nextAppointment}
      storedTimeZone={storedTimeZone}
      measurementCount={measurementCount}
      reviewedPrograms={reviewedPrograms}
      now={now}
      base={DASHBOARD_BASE}
      readOnly={false}
    />
  );
}
