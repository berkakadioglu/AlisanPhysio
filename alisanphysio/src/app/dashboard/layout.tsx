import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { formatDay, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { generateSystemNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import ClientDashboardShell, {
  type DashboardIdentity,
  type DashboardTab,
} from "@/components/client-dashboard-shell";
import AppHeader from "./app-header";
import WhatsAppButton from "./whatsapp-button";

/**
 * Wraps all client-facing pages (/dashboard/*) and adds the floating WhatsApp
 * button. Admin and login pages are outside this layout, so they don't get it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lazy and idempotent: includes the new 24h/12h appointment reminder RPC.
  // Keeping this in the authenticated layout covers every dashboard route,
  // rather than only the overview page.
  await generateSystemNotifications(supabase);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, created_at")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; created_at: string | null }>();

  const fallbackName = user.email?.split("@")[0] || t(lang, "dash.clientFallback");
  const name = profile?.full_name?.trim() || fallbackName;
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
    sinceLine: profile?.created_at
      ? t(lang, "dash.coachingSince", {
          date: formatDay(profile.created_at.slice(0, 10), lang),
        })
      : null,
    avatarLabel: t(lang, "dash.avatarLabel", { name }),
  };

  const tabs: DashboardTab[] = [
    { id: "overview", href: "/dashboard", label: t(lang, "dash.tab.overview") },
    {
      id: "programme",
      href: "/dashboard/programme",
      label: t(lang, "dash.tab.programme"),
    },
    {
      id: "nutrition",
      href: "/dashboard/nutrition",
      label: t(lang, "dash.tab.nutrition"),
    },
    {
      id: "progress",
      href: "/dashboard/progress",
      label: t(lang, "dash.tab.progress"),
    },
    {
      id: "schedule",
      href: "/dashboard/availability",
      label: t(lang, "dash.tab.schedule"),
    },
  ];

  return (
    <>
      <AppHeader container="max-w-6xl" />
      <ClientDashboardShell
        identity={identity}
        tabs={tabs}
        navigationLabel={t(lang, "dash.navigationLabel")}
      >
        {children}
      </ClientDashboardShell>
      <WhatsAppButton />
    </>
  );
}
