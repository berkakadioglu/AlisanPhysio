import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { clientViewBase } from "@/lib/client-view";
import { loadClientDashboardData } from "@/lib/dashboard-data";
import { reviewContextFor } from "@/lib/reviews";
import { getLang } from "@/lib/i18n-server";
import ProgrammeContent from "@/app/dashboard/programme-content";

export const metadata: Metadata = {
  title: `Programme · ${BRAND_NAME}`,
};

export default async function ClientViewProgrammePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();

  const { buckets } = await loadClientDashboardData(supabase, id);
  const { reviewedPrograms } = await reviewContextFor(supabase, id);

  return (
    <ProgrammeContent
      lang={lang}
      buckets={buckets}
      reviewedPrograms={reviewedPrograms}
      base={clientViewBase(id)}
      readOnly
    />
  );
}
