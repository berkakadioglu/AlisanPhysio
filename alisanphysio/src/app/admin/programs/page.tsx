import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarDays } from "lucide-react";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId, loadCatalogPrograms } from "@/lib/catalog-programs";
import { getLang } from "@/lib/i18n-server";
import { t, type Lang } from "@/lib/i18n";
import { programTimeZone } from "@/lib/month";
import { loadSavedDays, purgeExpiredSavedDays } from "@/lib/templates";
import AdminHeader from "../admin-header";
import CatalogList from "./catalog-list";
import SavedDaysTab from "./saved-days-tab";

/** `/admin/programs?tab=saved-days` — the second tab of this page. */
const SAVED_DAYS_TAB = "saved-days";

type Query = { client?: string; tab?: string };

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<Query>;
}): Promise<Metadata> {
  const [lang, query] = await Promise.all([getLang(), searchParams]);
  return { title: t(lang, query.tab === SAVED_DAYS_TAB ? "sd.heading" : "catalog.heading") };
}

/** Programmes | Saved days. Links (not ARIA tabs): each tab is its own URL. */
function ProgramsTabs({ lang, savedDays, clientId }: { lang: Lang; savedDays: boolean; clientId?: string }) {
  const tabs = [
    { href: `/admin/programs${clientId ? `?client=${clientId}` : ""}`, label: t(lang, "sd.tabProgrammes"), Icon: BookOpen, active: !savedDays },
    { href: `/admin/programs?tab=${SAVED_DAYS_TAB}`, label: t(lang, "sd.tabSavedDays"), Icon: CalendarDays, active: savedDays },
  ];
  return (
    <nav aria-label={t(lang, "sd.tabsLabel")} className="mb-8 border-b border-border">
      <ul className="-mb-px flex gap-1">
        {tabs.map(({ href, label, Icon, active }) => (
          <li key={href} className="min-w-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-t-xl border-b-2 px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:px-4 ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 flex-none" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<Query>;
}) {
  const [{ supabase, profile }, lang, query] = await Promise.all([requireStaff(), getLang(), searchParams]);
  const timeZone = programTimeZone(profile.timezone);

  if (query.tab === SAVED_DAYS_TAB) {
    // Lazily remove saved days that have been deleted for 30+ days first.
    await purgeExpiredSavedDays(supabase);
    const { live, deleted } = await loadSavedDays(supabase);
    return <div className="min-h-screen"><AdminHeader container="max-w-6xl" />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <ProgramsTabs lang={lang} savedDays />
        <SavedDaysTab live={live} deleted={deleted} timeZone={timeZone} />
      </main>
    </div>;
  }

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
      <ProgramsTabs lang={lang} savedDays={false} clientId={client?.id} />
      <CatalogList programs={programs} clientId={client?.id} timeZone={timeZone} />
    </main>
  </div>;
}
