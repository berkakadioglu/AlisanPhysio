import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { Measurement } from "@/lib/types";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import { ProgressMeasurements } from "../profile/profile-view";

export const metadata: Metadata = {
  title: `Progress · ${BRAND_NAME}`,
};

export default async function ProgressPage() {
  const supabase = await createClient();
  const lang = await getLang();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: measurements }] = await Promise.all([
    supabase
      .from("profiles")
      .select("height_cm")
      .eq("id", user.id)
      .maybeSingle<{ height_cm: number | null }>(),
    supabase
      .from("measurements")
      .select(
        "id, client_id, measured_on, weight_kg, waist_cm, hip_cm, arm_cm, chest_cm, created_at",
      )
      .eq("client_id", user.id)
      .order("measured_on", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Measurement[]>(),
  ]);

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-5xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "progress.eyebrow")}
        title={t(lang, "progress.title")}
        body={t(lang, "progress.body")}
      />
      <div className="mt-7">
        <ProgressMeasurements
          measurements={measurements ?? []}
          heightCm={profile?.height_cm ?? null}
          readOnly={false}
        />
      </div>
    </main>
  );
}
