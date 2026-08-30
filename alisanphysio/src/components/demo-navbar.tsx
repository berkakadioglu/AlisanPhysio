"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import ThemeToggle from "@/app/theme-toggle";
import DemoLanguageToggle from "@/components/demo-language-toggle";

export default function DemoNavbar({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const links = MARKETING.nav.links.map((link) => ({
    href: link.href,
    label: marketingText(lang, link.label),
  }));

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  const portalLabel = marketingText(lang, MARKETING.nav.portal.anonymous);

  return (
    <header className="marketing-navbar marketing-navbar--scrolled">
      <div className="marketing-container marketing-navbar__inner">
        <Link href="/" prefetch={false} className="marketing-wordmark">
          {MARKETING.brand.name}
        </Link>

        <nav
          className="marketing-navbar__links"
          aria-label={marketingText(lang, MARKETING.nav.primaryLabel)}
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="marketing-navbar__actions">
          <div className="marketing-navbar__desktop-controls">
            <DemoLanguageToggle label={marketingText(lang, MARKETING.nav.languageLabel)} />
            <ThemeToggle />
            <Link href="/login" prefetch={false} className="marketing-portal-link">
              {portalLabel}
            </Link>
          </div>

          <div className="md:hidden">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label={marketingText(lang, MARKETING.nav.menuLabel)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[80] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={marketingText(lang, MARKETING.nav.menuLabel)}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim"
          />
          <div
            ref={drawerRef}
            className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col border-l border-border bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <span className="font-display text-lg font-extrabold tracking-tight text-brand">
                {MARKETING.brand.name}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={marketingText(lang, MARKETING.nav.closeMenuLabel)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      onClick={() => setOpen(false)}
                      className={`flex items-center rounded-xl px-3.5 py-3 text-base font-medium transition ${
                        link.href === "/demo"
                          ? "bg-brand-tint text-brand"
                          : "text-foreground hover:bg-pill"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 px-1 py-1">
                <ThemeToggle />
                <DemoLanguageToggle label={marketingText(lang, MARKETING.nav.languageLabel)} />
              </div>
              <Link
                href="/login"
                prefetch={false}
                onClick={() => setOpen(false)}
                className="mt-2 flex w-full items-center justify-center rounded-xl bg-brand-solid px-3.5 py-3 text-base font-semibold text-white transition hover:bg-brand-solid-hover"
              >
                {portalLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
