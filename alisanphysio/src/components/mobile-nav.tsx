"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { useI18n } from "@/app/i18n-provider";
import ThemeToggle from "@/app/theme-toggle";
import LanguageToggle from "@/app/language-toggle";

export type MobileNavLink = { href: string; label: string };
export type MobileNavGroup = { label: string; items: MobileNavLink[] };

/**
 * Mobile-only hamburger + slide-in drawer, shared by the client and staff
 * headers. Renders nothing above the `md` breakpoint (the desktop nav takes
 * over). Holds the navigation links, an optional grouped section (the staff
 * "Content" areas), the theme + language controls (plus any extra utility
 * passed as children, e.g. Refresh), and Sign out. Closes on backdrop click,
 * the X, Escape, or a route change; locks body scroll while open.
 */
export default function MobileNav({
  homeHref,
  links,
  groups = [],
  signOutAction,
  children,
}: {
  homeHref: string;
  links: MobileNavLink[];
  groups?: MobileNavGroup[];
  signOutAction: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Every link closes the drawer via its own onClick (below), so there's no
  // need to watch the pathname — which also avoids a setState-in-effect.

  // Escape to close + lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const rowBase =
    "flex items-center rounded-xl px-3.5 py-3 text-base font-medium transition";
  const rowFor = (href: string) =>
    `${rowBase} ${
      isActive(href)
        ? "bg-brand-tint text-brand"
        : "text-foreground hover:bg-pill"
    }`;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.menu")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim"
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col border-l border-border bg-surface shadow-lift">
            {/* Drawer header: wordmark (links home) + close */}
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <Link
                href={homeHref}
                onClick={() => setOpen(false)}
                className="font-display text-lg font-extrabold tracking-tight text-brand"
              >
                {BRAND_NAME}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={rowFor(l.href)}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {groups.map(
                (group) =>
                  group.items.length > 0 && (
                    <div key={group.label} className="mt-4">
                      <p className="px-3.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                        {group.label}
                      </p>
                      <ul className="space-y-1">
                        {group.items.map((l) => (
                          <li key={l.href}>
                            <Link
                              href={l.href}
                              onClick={() => setOpen(false)}
                              className={rowFor(l.href)}
                            >
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </nav>

            {/* Utility controls + sign out */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 px-1 py-1">
                <ThemeToggle />
                <LanguageToggle />
                {children}
              </div>
              <form action={signOutAction} className="mt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-pill px-3.5 py-3 text-base font-semibold text-foreground transition hover:bg-brand-tint hover:text-brand"
                >
                  {t("common.signOut")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
