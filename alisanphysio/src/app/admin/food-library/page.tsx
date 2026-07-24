import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { loadFoodLibrary } from "@/lib/nutrition";
import AdminHeader from "@/app/admin/admin-header";
import FoodLibraryManager from "./food-library-manager";

export const metadata: Metadata = {
  title: `Food library · ${BRAND_NAME}`,
};

export default async function FoodLibraryPage() {
  const { supabase } = await requireStaff();
  const foods = await loadFoodLibrary(supabase);

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-5xl" />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <FoodLibraryManager foods={foods} />
      </main>
    </div>
  );
}
