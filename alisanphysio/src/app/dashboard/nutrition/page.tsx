import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { loadNutritionPlan, nutritionEnabled } from "@/lib/nutrition";
import { getLang } from "@/lib/i18n-server";
import { ClientNutritionView } from "./nutrition-content";

export const metadata: Metadata = {
  title: `Nutrition · ${BRAND_NAME}`,
};

export default async function ClientNutritionPage() {
  const supabase = await createClient();
  const lang = await getLang();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!await nutritionEnabled(supabase, user.id)) redirect("/dashboard");

  // RLS scopes the plan (and its meals/items) to the signed-in user only.
  const plan = await loadNutritionPlan(supabase, user.id);
  return <ClientNutritionView plan={plan} lang={lang} />;
}
