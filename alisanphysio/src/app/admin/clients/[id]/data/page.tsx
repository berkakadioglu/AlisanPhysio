import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { Complaint, Measurement } from "@/lib/types";
import AdminHeader from "@/app/admin/admin-header";
import ProfileView, { type ProfileData } from "@/app/dashboard/profile/profile-view";

export const metadata: Metadata = {
  title: `Client data · ${BRAND_NAME}`,
};

export default async function AdminClientDataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: measurements } = await supabase
    .from("measurements")
    .select("id, client_id, measured_on, weight_kg, waist_cm, hip_cm, arm_cm, chest_cm, created_at")
    .eq("client_id", id)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Measurement[]>();

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, client_id, body, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .returns<Complaint[]>();

  const displayName = profile.full_name?.trim() || email || "—";

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-4xl" />

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={`/admin/clients/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "admin.backToClient")}
        </Link>

        <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {t(lang, "profile.clientDataHeading")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t(lang, "profile.clientDataSubtitle", { name: displayName })}
        </p>

        <div className="mt-8">
          <ProfileView
            profile={profile}
            email={email}
            measurements={measurements ?? []}
            complaints={complaints ?? []}
            readOnly
          />
        </div>
      </main>
    </div>
  );
}
