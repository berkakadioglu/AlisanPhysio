import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { Measurement } from "@/lib/types";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import { ProgressMeasurements } from "@/app/dashboard/profile/profile-view";

export const metadata: Metadata = {
  title: `Progress · ${BRAND_NAME}`,
};

/** Staff "view as client" progress: the client's weigh-ins and circumferences, read-only. */
export default async function ClientViewProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();

  const [{ data: profile }, { data: measurements }] = await Promise.all([
    supabase
      .from("profiles")
      .select("height_cm")
      .eq("id", id)
      .maybeSingle<{ height_cm: number | null }>(),
    supabase
      .from("measurements")
      .select(
        "id, client_id, measured_on, weight_kg, waist_cm, hip_cm, arm_cm, chest_cm, created_at",
      )
      .eq("client_id", id)
      .order("measured_on", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Measurement[]>(),
  ]);

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-5xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "progress.eyebrow")}
        title={t(lang, "progress.title")}
      />
      <div className="mt-7">
        <ProgressMeasurements
          measurements={measurements ?? []}
          heightCm={profile?.height_cm ?? null}
          readOnly
        />
      </div>
    </main>
  );
}
