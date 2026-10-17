"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  BarChart3,
  CalendarDays,
  Dumbbell,
  Home,
  type LucideIcon,
} from "lucide-react";

export type DashboardTabId =
  | "overview"
  | "programme"
  | "nutrition"
  | "progress"
  | "schedule";

export interface DashboardIdentity {
  initials: string;
  name: string;
  coachLine: string;
  sinceLine: string | null;
  avatarLabel: string;
}

export interface DashboardTab {
  id: DashboardTabId;
  href: string;
  label: string;
}

const TAB_ICONS: Record<DashboardTabId, LucideIcon> = {
  overview: Home,
  programme: Dumbbell,
  nutrition: Apple,
  progress: BarChart3,
  schedule: CalendarDays,
};

/**
 * Resolves the active tab for a path under `basePath`. A staff "view as client"
 * mirror passes its own base and is mapped back onto the dashboard route names,
 * so both trees share the same tab rules. Anything outside `basePath` has no tab.
 */
export function activeTabFor(pathname: string, basePath = "/dashboard"): DashboardTabId | null {
  let path: string;
  if (pathname === basePath) path = "/dashboard";
  else if (pathname.startsWith(`${basePath}/`)) path = `/dashboard${pathname.slice(basePath.length)}`;
  else return null;

  if (path === "/dashboard") return "overview";
  if (path.startsWith("/dashboard/nutrition")) return "nutrition";
  if (path.startsWith("/dashboard/progress")) return "progress";
  if (path.startsWith("/dashboard/availability")) return "schedule";
  if (
    path.startsWith("/dashboard/programme") ||
    path.startsWith("/dashboard/past") ||
    path.startsWith("/dashboard/upcoming")
  ) {
    return "programme";
  }

  // Programme detail pages are the remaining direct dashboard children.
  if (/^\/dashboard\/[^/]+$/.test(path)) {
    if (path === "/dashboard/profile" || path === "/dashboard/review") {
      return null;
    }
    return "programme";
  }
  return null;
}

/**
 * Pure dashboard chrome: identity, route navigation and the demo-aligned panel
 * surface. Authentication and profile loading stay in the server layout.
 */
export default function ClientDashboardShell({
  basePath = "/dashboard",
  identity,
  tabs,
  navigationLabel,
  footer,
  children,
}: {
  /** Route root the tabs live under; the staff "view as client" tree passes its own. */
  basePath?: string;
  identity: DashboardIdentity;
  tabs: DashboardTab[];
  navigationLabel: string;
  /** Omitted where the surrounding layout already renders the credit (admin). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = activeTabFor(pathname, basePath);

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="min-w-0 overflow-clip rounded-[1.5rem] border border-border bg-background/85 shadow-lift sm:rounded-[2rem]">
        <header className="flex min-w-0 items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
          <span
            role="img"
            aria-label={identity.avatarLabel}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-solid font-display text-sm font-extrabold text-white"
          >
            {identity.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-bold text-foreground">
              {identity.name}
            </p>
            <p className="break-words text-xs leading-relaxed text-muted-foreground">
              {identity.coachLine}
            </p>
          </div>
          {identity.sinceLine && (
            <span className="hidden flex-none text-xs font-medium text-muted-foreground md:block">
              {identity.sinceLine}
            </span>
          )}
        </header>

        <nav className="border-b border-border p-2 sm:p-3" aria-label={navigationLabel}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const active = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:text-sm ${
                    active
                      ? "bg-brand-solid text-white shadow-soft"
                      : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-none" aria-hidden />
                  <span className="min-w-0 break-words text-center leading-tight">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
      {footer != null && <footer className="studio-shell-footer">{footer}</footer>}
    </div>
  );
}
