import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { loadFoodLibrary, loadNutritionPlan } from "@/lib/nutrition";
import AdminHeader from "@/app/admin/admin-header";
import NutritionEditor from "@/app/admin/nutrition-editor";

export const metadata: Metadata = {
  title: `Nutrition plan · ${BRAND_NAME}`,
};

export default async function ClientNutritionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lang = await getLang();
  const { supabase } = await requireStaff();

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, nutrition_enabled")
    .eq("id", id)
    .maybeSingle<Pick<Profile, "id" | "full_name" | "nutrition_enabled">>();
  if (!client) {
    notFound();
  }

  const [foods, plan] = await Promise.all([
    loadFoodLibrary(supabase),
    loadNutritionPlan(supabase, id, true),
  ]);

  // Resolve a friendly display name (email fallback via the service-role client).
  let displayName = client.full_name?.trim() ?? "";
  if (!displayName) {
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(id);
    displayName = authUser?.user?.email ?? "client";
  }

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-5xl" />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {!client.nutrition_enabled && <p className="mb-5 rounded-xl bg-pill p-4 text-sm text-muted-foreground">{t(lang, "nutrition.hiddenNote")}</p>}
        <NutritionEditor
          clientId={id}
          clientName={displayName}
          plan={plan}
          foods={foods}
        />
      </main>
    </div>
  );
}
