import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/constants";
import { loadDashboardData } from "@/lib/dashboard-data";
import { reviewedProgramSet } from "@/lib/reviews";
import { DASHBOARD_BASE } from "@/lib/client-view";
import { getLang } from "@/lib/i18n-server";
import ProgrammeContent from "../programme-content";

export const metadata: Metadata = {
  title: `Programme · ${BRAND_NAME}`,
};

export default async function ProgrammePage() {
  const { buckets } = await loadDashboardData();
  const lang = await getLang();
  const reviewedPrograms = await reviewedProgramSet();

  return (
    <ProgrammeContent
      lang={lang}
      buckets={buckets}
      reviewedPrograms={reviewedPrograms}
      base={DASHBOARD_BASE}
      readOnly={false}
    />
  );
}
