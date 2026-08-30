"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useI18n } from "@/app/i18n-provider";
import ThemeToggle from "@/app/theme-toggle";
import LanguageToggle from "@/app/language-toggle";

export type MobileNavLink = {
  href: string;
  label: string;
  badge?: number;
};
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
  cta,
  menuLabel,
  closeMenuLabel,
  brandName,
  showDrawerBrand = true,
  breakpoint = "md",
  children,
}: {
  homeHref: string;
  links: MobileNavLink[];
  groups?: MobileNavGroup[];
  signOutAction?: () => void;
  cta?: MobileNavLink;
  menuLabel?: string;
  closeMenuLabel?: string;
  brandName?: string;
  showDrawerBrand?: boolean;
  breakpoint?: "md" | "lg";
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Every link closes the drawer via its own onClick (below), so there's no
  // need to watch the pathname — which also avoids a setState-in-effect.

  // Treat the drawer as a real modal: move focus in, keep it inside, restore
  // it to the trigger on close, and lock background scrolling.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.tabIndex >= 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger?.focus();
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
    <div className={breakpoint === "lg" ? "lg:hidden" : "md:hidden"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={menuLabel ?? t("nav.menu")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          aria-label={menuLabel ?? t("nav.menu")}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim"
          />
          <div ref={drawerRef} className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col border-l border-border bg-surface shadow-lift">
            {/* Drawer header: wordmark (links home) + close */}
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              {showDrawerBrand ? (
                <Link
                  href={homeHref}
                  onClick={() => setOpen(false)}
                  className="font-display text-lg font-extrabold tracking-tight text-brand"
                >
                  {brandName ?? BRAND.name}
                </Link>
              ) : (
                <span aria-hidden />
              )}
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeMenuLabel ?? t("nav.closeMenu")}
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
                      <span className="min-w-0 flex-1">{l.label}</span>
                      {typeof l.badge === "number" && l.badge > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1.5 text-[10px] font-bold tabular-nums text-white">
                          {l.badge > 99 ? "99+" : l.badge}
                        </span>
                      )}
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
                              <span className="min-w-0 flex-1">{l.label}</span>
                              {typeof l.badge === "number" && l.badge > 0 && (
                                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1.5 text-[10px] font-bold tabular-nums text-white">
                                  {l.badge > 99 ? "99+" : l.badge}
                                </span>
                              )}
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
              {signOutAction && (
                <form action={signOutAction} className="mt-2">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-pill px-3.5 py-3 text-base font-semibold text-foreground transition hover:bg-brand-tint hover:text-brand"
                  >
                    {t("common.signOut")}
                  </button>
                </form>
              )}
              {cta && (
                <Link
                  href={cta.href}
                  onClick={() => setOpen(false)}
                  className="mt-2 flex w-full items-center justify-center rounded-xl bg-brand-solid px-3.5 py-3 text-base font-semibold text-white transition hover:bg-brand-solid-hover"
                >
                  {cta.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
