import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { loadTemplateSummaries } from "@/lib/templates";
import AdminHeader from "@/app/admin/admin-header";
import TemplatesList from "./templates-list";

export const metadata: Metadata = {
  title: `Day templates · ${BRAND_NAME}`,
};

export default async function TemplatesPage() {
  const { supabase } = await requireStaff();
  const templates = await loadTemplateSummaries(supabase);

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <TemplatesList templates={templates} />
      </main>
    </div>
  );
}
