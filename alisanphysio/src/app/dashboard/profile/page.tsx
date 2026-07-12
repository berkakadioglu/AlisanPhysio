import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { Complaint, Measurement } from "@/lib/types";
import AppHeader from "../app-header";
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

  // Own profile (RLS scopes to the signed-in user).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, height_cm, membership, membership_end_date")
    .eq("id", user.id)
    .single<ProfileData>();

  // Scope to the signed-in user's OWN rows. Staff can read all measurements/
  // complaints via RLS, so the self-service profile MUST filter by user id.
  const { data: measurements } = await supabase
    .from("measurements")
    .select("id, client_id, measured_on, weight_kg, waist_cm, hip_cm, arm_cm, chest_cm, created_at")
    .eq("client_id", user.id)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Measurement[]>();

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, client_id, body, created_at")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Complaint[]>();

  const data: ProfileData = profile ?? {
    id: user.id,
    full_name: null,
    height_cm: null,
    membership: null,
    membership_end_date: null,
  };

  return (
    <div className="min-h-screen">
      <AppHeader container="max-w-4xl" />

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "prog.back")}
        </Link>

        <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {t(lang, "profile.heading")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t(lang, "profile.subtitle")}
        </p>

        <div className="mt-8">
          <ProfileView
            profile={data}
            email={user.email ?? ""}
            measurements={measurements ?? []}
            complaints={complaints ?? []}
          />
        </div>
      </main>
    </div>
  );
}
