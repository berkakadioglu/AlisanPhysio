import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { Complaint } from "@/lib/types";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import ProfileView, { type ProfileData } from "./profile-view";

export const metadata: Metadata = {
  title: `Profile · ${BRAND_NAME}`,
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const lang = await getLang();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: complaints }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, height_cm, membership, membership_end_date, timezone")
      .eq("id", user.id)
      .single<ProfileData>(),
    supabase
      .from("complaints")
      .select("id, client_id, body, created_at")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .returns<Complaint[]>(),
  ]);

  const data: ProfileData = profile ?? {
    id: user.id,
    full_name: null,
    height_cm: null,
    membership: null,
    membership_end_date: null,
    timezone: null,
  };

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "profile.accountEyebrow")}
        title={t(lang, "profile.heading")}
        body={t(lang, "profile.subtitle")}
      />
      <div className="mt-7">
        <ProfileView
          profile={data}
          email={user.email ?? ""}
          measurements={[]}
          complaints={complaints ?? []}
          showMeasurements={false}
        />
      </div>
    </main>
  );
}
