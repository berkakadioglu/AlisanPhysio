import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { firstNameOf, loadClientDashboardData } from "@/lib/dashboard-data";
import { clientViewBase, loadClientAppointmentsForStaff, nextUpcomingAppointment } from "@/lib/client-view";
import { reviewContextFor } from "@/lib/reviews";
import { nutritionPlanSummary } from "@/lib/nutrition";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import OverviewContent from "@/app/dashboard/overview-content";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "dash.tab.overview")} · ${BRAND_NAME}` };
}

/** One stable clock read for the whole server render. */
function requestTimeMs(): number {
  return Date.now();
}

export default async function ClientViewOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();
  const now = requestTimeMs();

  const { profile, buckets } = await loadClientDashboardData(supabase, id);
  const firstName = firstNameOf(profile);
  const { reviewedPrograms } = await reviewContextFor(supabase, id);

  const nutrition = profile?.nutrition_enabled
    ? await nutritionPlanSummary(supabase, id)
    : { hasPlan: false, mealCount: 0 };

  const [appointments, measurementResult] = await Promise.all([
    loadClientAppointmentsForStaff(supabase, id, new Date(now - 24 * 60 * 60 * 1_000).toISOString()),
    supabase
      .from("measurements")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id),
  ]);

  return (
    <OverviewContent
      lang={lang}
      firstName={firstName}
      buckets={buckets}
      nutritionEnabled={Boolean(profile?.nutrition_enabled)}
      mealCount={nutrition.mealCount}
      nextAppointment={nextUpcomingAppointment(appointments, now)}
      storedTimeZone={profile?.timezone ?? null}
      measurementCount={measurementResult.count ?? 0}
      reviewedPrograms={reviewedPrograms}
      now={now}
      base={clientViewBase(id)}
      readOnly
    />
  );
}
