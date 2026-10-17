import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { loadNutritionPlan, nutritionEnabled } from "@/lib/nutrition";
import { getLang } from "@/lib/i18n-server";
import { ClientNutritionView } from "@/app/dashboard/nutrition/nutrition-content";

export const metadata: Metadata = {
  title: `Nutrition · ${BRAND_NAME}`,
};

/** Staff "view as client" nutrition: the client's plan, read-only. */
export default async function ClientViewNutritionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();

  // Same gate the client sees: a client without nutrition has no such view.
  if (!(await nutritionEnabled(supabase, id))) notFound();

  // Scoped to the CLIENT being viewed, not to the signed-in staff member.
  const plan = await loadNutritionPlan(supabase, id);
  return <ClientNutritionView plan={plan} lang={lang} />;
}
