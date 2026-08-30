"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";
import MobileNav, { type MobileNavLink } from "@/components/mobile-nav";

export default function MarketingNavbar({
  lang,
  portalHref,
  portalLabel,
}: {
  lang: Lang;
  portalHref: string;
  portalLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 12);
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      const progress = distance > 0 ? Math.min(window.scrollY / distance, 1) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const links: MobileNavLink[] = [
    ...MARKETING.nav.links.map((link) => ({
      href: link.href,
      label: marketingText(lang, link.label),
    })),
  ];

  return (
    <header
      className={`marketing-navbar${scrolled ? " marketing-navbar--scrolled" : ""}`}
    >
      <span className="marketing-scroll-progress" aria-hidden>
        <span ref={progressRef} />
      </span>
      <div className="marketing-container marketing-navbar__inner">
        <Link href="/" className="marketing-wordmark" aria-label={MARKETING.brand.name}>
          {MARKETING.brand.name}
        </Link>

        <nav
          className="marketing-navbar__links"
          aria-label={marketingText(lang, MARKETING.nav.primaryLabel)}
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="marketing-navbar__actions">
          <div className="marketing-navbar__desktop-controls">
            <LanguageToggle />
            <ThemeToggle />
            <Link href={portalHref} className="marketing-portal-link">
              {portalLabel}
            </Link>
          </div>
          <MobileNav
            homeHref="/"
            links={links}
            cta={{ href: portalHref, label: portalLabel }}
            menuLabel={marketingText(lang, MARKETING.nav.menuLabel)}
            closeMenuLabel={marketingText(lang, MARKETING.nav.closeMenuLabel)}
            brandName={MARKETING.brand.name}
            showDrawerBrand={false}
          />
        </div>
      </div>
    </header>
  );
}
