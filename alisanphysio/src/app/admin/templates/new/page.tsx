import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { loadLibrary } from "@/lib/categories";
import AdminHeader from "@/app/admin/admin-header";
import TemplateEditor from "../template-editor";

export const metadata: Metadata = {
  title: `New template · ${BRAND_NAME}`,
};

export default async function NewTemplatePage() {
  const { supabase } = await requireStaff();
  const { exercises: library, categories } = await loadLibrary(supabase);

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <TemplateEditor
          initial={{ title: "", exercises: [] }}
          library={library}
          categories={categories}
        />
      </main>
    </div>
  );
}
