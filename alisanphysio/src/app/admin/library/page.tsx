import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { loadLibrary } from "@/lib/categories";
import AdminHeader from "@/app/admin/admin-header";
import LibraryManager from "./library-manager";

export const metadata: Metadata = {
  title: `Exercise library · ${BRAND_NAME}`,
};

type Query = { q?: string | string[]; edit?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Deep links (e.g. "Open in library" in the programme editor):
 * `?edit=<library id>` opens that entry's edit dialog, `?q=<text>` pre-fills
 * the search.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [{ supabase }, query] = await Promise.all([requireStaff(), searchParams]);
  const { exercises, categories } = await loadLibrary(supabase);
  const initialQuery = first(query.q).trim().slice(0, 200);
  const initialEditId = first(query.edit).trim() || null;

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-5xl" />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <LibraryManager
          exercises={exercises}
          categories={categories}
          initialQuery={initialQuery}
          initialEditId={initialEditId}
        />
      </main>
    </div>
  );
}
