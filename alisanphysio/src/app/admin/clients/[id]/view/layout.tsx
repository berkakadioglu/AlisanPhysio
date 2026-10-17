import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import ClientDashboardShell, {
  type DashboardIdentity,
  type DashboardTab,
} from "@/components/client-dashboard-shell";
import { BRAND } from "@/lib/brand";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { clientViewBase } from "@/lib/client-view";
import { formatDay, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminHeader from "@/app/admin/admin-header";

/**
 * Staff "view as client" shell: the client's dashboard chrome and tabs, read-only,
 * under a sticky banner. Staff keep their own session; nothing here writes.
 * The admin layout already renders the studio credit, so the shell gets no footer.
 */
export default async function ClientViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, nutrition_enabled")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      full_name: string | null;
      created_at: string | null;
      nutrition_enabled: boolean;
    }>();
  if (!profile) notFound();

  // The email is only the name fallback for clients without a full name.
  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? "";

  const name =
    profile.full_name?.trim() ||
    email.split("@")[0] ||
    t(lang, "dash.clientFallback");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US"))
    .join("") || "AP";

  const identity: DashboardIdentity = {
    initials,
    name,
    coachLine: t(lang, "dash.coachLine", { name: BRAND.trainerName }),
    sinceLine: profile.created_at
      ? t(lang, "dash.coachingSince", {
          date: formatDay(profile.created_at.slice(0, 10), lang),
        })
      : null,
    avatarLabel: t(lang, "dash.avatarLabel", { name }),
  };

  const base = clientViewBase(id);
  const tabs: DashboardTab[] = [
    { id: "overview", href: base, label: t(lang, "dash.tab.overview") },
    {
      id: "programme",
      href: `${base}/programme`,
      label: t(lang, "dash.tab.programme"),
    },
    ...(profile.nutrition_enabled ? [{ id: "nutrition" as const, href: `${base}/nutrition`, label: t(lang, "dash.tab.nutrition") }] : []),
    {
      id: "progress",
      href: `${base}/progress`,
      label: t(lang, "dash.tab.progress"),
    },
    {
      id: "schedule",
      href: `${base}/availability`,
      label: t(lang, "dash.tab.schedule"),
    },
  ];

  return (
    <>
      <AdminHeader container="max-w-6xl" />
      <div role="status" className="sticky top-0 z-20 border-b border-brand/25 bg-brand-tint">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-sm sm:px-6 lg:px-8">
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-brand">
            <Eye className="h-4 w-4 flex-none" aria-hidden />
            <span className="min-w-0 break-words">{t(lang, "view.banner", { name })}</span>
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href={`${base}/profile`}
              className="inline-flex min-h-9 items-center font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
            >
              {t(lang, "view.profile")}
            </Link>
            <Link
              href={`/admin/clients/${id}`}
              className="inline-flex min-h-9 items-center gap-1 font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
            >
              <span aria-hidden>←</span> {t(lang, "admin.backToClient")}
            </Link>
          </span>
        </div>
      </div>
      <ClientDashboardShell
        basePath={base}
        identity={identity}
        tabs={tabs}
        navigationLabel={t(lang, "dash.navigationLabel")}
      >
        {children}
      </ClientDashboardShell>
    </>
  );
}
