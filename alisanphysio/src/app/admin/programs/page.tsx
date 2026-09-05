import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId, loadCatalogPrograms } from "@/lib/catalog-programs";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { programTimeZone } from "@/lib/month";
import AdminHeader from "../admin-header";
import CatalogList from "./catalog-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), "catalog.heading") };
}

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<{ client?: string }>;
}) {
  const [{ supabase, profile }, lang, query] = await Promise.all([requireStaff(), getLang(), searchParams]);
  const [programs, clientResult] = await Promise.all([
    loadCatalogPrograms(supabase),
    isProgramId(query.client) ? supabase.from("profiles").select("id, full_name")
      .eq("id", query.client).eq("role", "client").maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (clientResult.error) throw new Error("Could not load client");
  const client = clientResult.data;
  return <div className="min-h-screen"><AdminHeader container="max-w-6xl" />
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      {client && <div className="mb-6 space-y-2">
        <Link href={`/admin/clients/${client.id}`} className="text-sm font-medium text-brand">← {t(lang, "editor.backToClient")}</Link>
        <p className="text-sm text-muted-foreground">{t(lang, "catalog.chooseFor", { name: client.full_name || t(lang, "catalog.unnamedClient") })}</p>
      </div>}
      <CatalogList programs={programs} clientId={client?.id} timeZone={programTimeZone(profile.timezone)} />
    </main>
  </div>;
}
