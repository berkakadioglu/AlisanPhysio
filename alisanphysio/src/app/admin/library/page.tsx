import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { loadLibrary } from "@/lib/categories";
import AdminHeader from "@/app/admin/admin-header";
import LibraryManager from "./library-manager";

export const metadata: Metadata = {
  title: `Exercise library · ${BRAND_NAME}`,
};

export default async function LibraryPage() {
  const { supabase } = await requireStaff();
  const { exercises, categories } = await loadLibrary(supabase);

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-5xl" />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <LibraryManager exercises={exercises} categories={categories} />
      </main>
    </div>
  );
}
