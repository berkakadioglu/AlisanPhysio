import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId, loadCatalogClients } from "@/lib/catalog-programs";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import AdminHeader from "../../../admin-header";
import CatalogAssignForm from "../../catalog-assign-form";

export default async function AssignPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ client?: string }>;
}) {
  const [{ supabase }, lang, { id }, query] = await Promise.all([requireStaff(), getLang(), params, searchParams]);
  if (!isProgramId(id)) notFound();
  const [{ data: source, error }, clients] = await Promise.all([
    supabase.from("programs").select("id, title").eq("kind", "catalog").eq("id", id).maybeSingle(),
    loadCatalogClients(supabase),
  ]);
  if (error) throw new Error("Could not load catalogue programme");
  if (!source) notFound();
  const initialClientId = clients.some((client) => client.id === query.client) ? query.client! : "";
  return <div className="min-h-screen"><AdminHeader container="max-w-3xl" />
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href={`/admin/programs${initialClientId ? `?client=${initialClientId}` : ""}`} className="text-sm font-medium text-brand">← {t(lang, "catalog.back")}</Link>
      <h1 className="mt-5 font-display text-3xl font-extrabold text-foreground">{t(lang, "catalog.assign")}</h1>
      <p className="mt-2 break-words text-lg font-semibold text-foreground [overflow-wrap:anywhere]">{source.title}</p>
      <CatalogAssignForm sourceId={source.id} clients={clients} initialClientId={initialClientId} />
    </main>
  </div>;
}
