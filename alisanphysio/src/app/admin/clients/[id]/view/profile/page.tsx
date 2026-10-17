import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { Complaint } from "@/lib/types";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import ProfileView, { type ProfileData } from "@/app/dashboard/profile/profile-view";

export const metadata: Metadata = {
  title: `Profile · ${BRAND_NAME}`,
};

/** Staff "view as client" profile: the client's details and notes, read-only. */
export default async function ClientViewProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();

  // Admin reads the client's rows via the admin SELECT RLS policies.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, height_cm, membership, membership_end_date, timezone")
    .eq("id", id)
    .maybeSingle<ProfileData>();
  if (!profile) notFound();

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? "";

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, client_id, body, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .returns<Complaint[]>();

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "profile.accountEyebrow")}
        title={t(lang, "profile.heading")}
      />
      <div className="mt-7">
        <ProfileView
          profile={profile}
          email={email}
          measurements={[]}
          complaints={complaints ?? []}
          readOnly
          showMeasurements={false}
        />
      </div>
    </main>
  );
}
