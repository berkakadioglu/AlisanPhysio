import Link from "next/link";
import { LogOut } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { signOut } from "@/app/dashboard/actions";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import { requireStaff } from "@/lib/admin-auth";
import { generateDueAppointmentReminders } from "@/lib/notifications";
import MobileNav, {
  type MobileNavGroup,
  type MobileNavLink,
} from "@/components/mobile-nav";
import RefreshButton from "./refresh-button";
import ContentNav from "./content-nav";
import MeNav from "./me-nav";

/**
 * Admin top bar: wordmark → /admin, primary nav (Clients, a grouped "Content"
 * dropdown for the authoring areas, and Personal Exercises), plus the utility
 * controls (notifications, theme, language, refresh, sign out).
 */
export default async function AdminHeader({
  container = "max-w-3xl",
}: {
  container?: string;
}) {
  const [lang, { profile, supabase }] = await Promise.all([
    getLang(),
    requireStaff(),
  ]);
  const isAdmin = profile.role === "admin";
  const [
    ,
    { count: pendingAppointmentCount },
    { count: pendingProposalCount },
    requestResult,
  ] = await Promise.all([
    generateDueAppointmentReminders(supabase),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("client_proposals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    isAdmin
      ? supabase
          .from("assessment_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "new")
      : Promise.resolve({ count: 0 }),
  ]);
  const schedulingPendingCount =
    (pendingAppointmentCount ?? 0) + (pendingProposalCount ?? 0);
  const newRequestCount = requestResult.count ?? 0;
  const navLink =
    "rounded-full px-3 py-1.5 font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground";

  // Mobile drawer: top-level links + the "Content" and "Me" grouped sections.
  const mobileLinks: MobileNavLink[] = [
    { href: "/admin", label: t(lang, "admin.clients") },
    ...(isAdmin
      ? [
          {
            href: "/admin/requests",
            label: t(lang, "requests.nav"),
            badge: newRequestCount,
          },
        ]
      : []),
    {
      href: "/admin/availability",
      label: t(lang, "schedule.nav"),
      badge: schedulingPendingCount,
    },
  ];
  const contentGroup: MobileNavGroup = {
    label: t(lang, "nav.content"),
    items: [
      { href: "/admin/library", label: t(lang, "nav.exerciseLibrary") },
      { href: "/admin/food-library", label: t(lang, "nav.foodLibrary") },
      { href: "/admin/templates", label: t(lang, "nav.dayTemplates") },
    ],
  };
  const meGroup: MobileNavGroup = {
    label: t(lang, "nav.me"),
    items: [
      { href: "/dashboard", label: t(lang, "nav.personalExercises") },
      { href: "/dashboard/profile", label: t(lang, "profile.link") },
    ],
  };

  return (
    <header className="border-b border-border bg-surface shadow-soft">
      <div
        className={`mx-auto flex ${container} items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:max-w-7xl`}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="font-display text-lg font-extrabold tracking-tight text-brand"
          >
            {BRAND_NAME}
          </Link>
          {/* Desktop nav (hidden on mobile — see the drawer below) */}
          <nav className="hidden items-center gap-1 text-sm lg:flex">
            <Link href="/admin" className={navLink}>
              {t(lang, "admin.clients")}
            </Link>
            {isAdmin && (
              <Link
                href="/admin/requests"
                className={`${navLink} inline-flex items-center gap-1.5`}
              >
                {t(lang, "requests.nav")}
                {newRequestCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1.5 text-[10px] font-bold tabular-nums text-white">
                    {newRequestCount > 99 ? "99+" : newRequestCount}
                  </span>
                )}
              </Link>
            )}
            <ContentNav />
            <Link
              href="/admin/availability"
              className={`${navLink} inline-flex items-center gap-1.5`}
            >
              {t(lang, "schedule.nav")}
              {schedulingPendingCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1.5 text-[10px] font-bold tabular-nums text-white">
                  {schedulingPendingCount > 99
                    ? "99+"
                    : schedulingPendingCount}
                </span>
              )}
            </Link>
            <MeNav />
          </nav>
        </div>

        {/* Desktop utilities */}
        <div className="hidden items-center gap-1.5 lg:flex">
          <NotificationBell />
          <ThemeToggle />
          <LanguageToggle />
          <RefreshButton />
          <form action={signOut}>
            <button
              type="submit"
              aria-label={t(lang, "common.signOut")}
              title={t(lang, "common.signOut")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>

        {/* Mobile: notification bell stays visible + hamburger drawer */}
        <div className="flex items-center gap-1 lg:hidden">
          <NotificationBell />
          <MobileNav
            homeHref="/admin"
            links={mobileLinks}
            groups={[contentGroup, meGroup]}
            signOutAction={signOut}
            breakpoint="lg"
          >
            <RefreshButton />
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
