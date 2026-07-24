"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";

export type NavDropdownItem = { href: string; label: string; Icon: LucideIcon };

/**
 * A generic desktop nav dropdown (used for the "Content" and "Me" groups in the
 * admin header). Click to open; closes on outside click, Escape, or picking an
 * item. The trigger highlights when the current route is one of its items.
 * Mobile uses the drawer groups instead — this renders inline for md+.
 */
export default function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: NavDropdownItem[];
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const active = items.some((it) => isItemActive(it.href));

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium transition hover:bg-pill hover:text-foreground ${
          active || open ? "bg-pill text-foreground" : "text-muted-foreground"
        }`}
      >
        {t(label)}
        <ChevronDown
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lift"
        >
          {items.map(({ href, label: itemLabel, Icon }) => {
            const isActive = isItemActive(href);
            return (
              <li key={href} role="none">
                <Link
                  role="menuitem"
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-tint text-brand"
                      : "text-foreground hover:bg-pill hover:text-brand"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-none" aria-hidden />
                  <span className="truncate">{t(itemLabel)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
