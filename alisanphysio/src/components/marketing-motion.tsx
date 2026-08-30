"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlarmClock,
  Apple,
  Dumbbell,
  Droplets,
  Flame,
  Footprints,
  HeartPulse,
  Timer,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { MARKETING, marketingText } from "@/lib/marketing-content";

const veilIcons: LucideIcon[] = [
  Dumbbell,
  Apple,
  HeartPulse,
  AlarmClock,
  Droplets,
  Footprints,
  Timer,
  Flame,
  Activity,
  Waves,
];

const completedCounterKeys = new Set<string>();

function counterKey(element: HTMLElement) {
  return `${element.dataset.marketingCount ?? "0"}:${element.dataset.marketingCountSuffix ?? ""}`;
}

function counterIsComplete(element: HTMLElement) {
  return (
    element.dataset.marketingCountComplete === "true" ||
    completedCounterKeys.has(counterKey(element))
  );
}

function finishCounter(element: HTMLElement) {
  const target = Number(element.dataset.marketingCount ?? 0);
  const suffix = element.dataset.marketingCountSuffix ?? "";
  element.textContent = `${target}${suffix}`;
  element.dataset.marketingCountComplete = "true";
  completedCounterKeys.add(counterKey(element));
}

function animateCounter(element: HTMLElement) {
  const target = Number(element.dataset.marketingCount ?? 0);
  const suffix = element.dataset.marketingCountSuffix ?? "";
  const startedAt = performance.now();
  const duration = 1000;
  element.dataset.marketingCountStarted = "true";

  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    if (progress < 1) {
      element.textContent = `${Math.round(target * eased)}${suffix}`;
      frame = requestAnimationFrame(tick);
    } else {
      finishCounter(element);
    }
  };

  element.textContent = `0${suffix}`;
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function prepareBenefitIcons(root: HTMLElement, finish = false) {
  root
    .querySelectorAll<SVGGeometryElement>(".marketing-benefit > svg *")
    .forEach((geometry) => {
      if (typeof geometry.getTotalLength !== "function") return;
      try {
        const length = Math.max(1, geometry.getTotalLength());
        geometry.style.strokeDasharray = String(length);
        geometry.style.strokeDashoffset = finish ? "0" : String(length);
      } catch {
        geometry.style.strokeDashoffset = "0";
      }
    });
}

function isWithinViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

export default function MarketingMotion({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".marketing");
    if (!root) return;
    const html = document.documentElement;

    const items = Array.from(
      root.querySelectorAll<HTMLElement>("[data-marketing-reveal]"),
    );
    const counters = Array.from(
      root.querySelectorAll<HTMLElement>("[data-marketing-count]"),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      html.classList.remove("marketing-motion-enabled");
      root.classList.remove("marketing-motion-ready");
      items.forEach((item) => item.classList.add("is-visible"));
      counters.forEach(finishCounter);
      prepareBenefitIcons(root, true);
      return;
    }

    html.classList.add("marketing-motion-enabled");
    html.classList.remove("marketing-motion-fallback");
    root.classList.add("marketing-motion-ready");
    counters.forEach((counter) => {
      if (counterIsComplete(counter)) {
        finishCounter(counter);
      } else {
        counter.textContent = `0${counter.dataset.marketingCountSuffix ?? ""}`;
      }
    });
    prepareBenefitIcons(root);

    const counterCleanups = new Set<() => void>();
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 },
    );
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          counterCleanups.add(animateCounter(entry.target as HTMLElement));
          countObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.55 },
    );

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        items.forEach((item) => {
          if (item.classList.contains("is-visible") || isWithinViewport(item)) {
            item.classList.add("is-visible");
            return;
          }
          revealObserver.observe(item);
        });
        counters.forEach((counter) => {
          if (counterIsComplete(counter)) {
            finishCounter(counter);
            return;
          }
          if (isWithinViewport(counter)) {
            counterCleanups.add(animateCounter(counter));
            return;
          }
          countObserver.observe(counter);
        });
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      revealObserver.disconnect();
      countObserver.disconnect();
      counterCleanups.forEach((cleanup) => cleanup());
      counters
        .filter((counter) => counter.dataset.marketingCountStarted === "true")
        .forEach(finishCounter);
      root.classList.remove("marketing-motion-ready");
    };
  }, [lang, pathname]);

  useEffect(() => {
    if (pathname !== "/" || !("IntersectionObserver" in window)) return;

    const sections = MARKETING.motion.sectionLinks
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (current?.target.id) setActiveSection(current.target.id);
      },
      { rootMargin: "-34% 0px -55%", threshold: [0, 0.1, 0.25, 0.5] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <>
      <div className="marketing-loading-veil" aria-hidden>
        <div className="marketing-loading-veil__icons">
          {veilIcons.map((Icon, index) => (
            <Icon key={index} />
          ))}
        </div>
        <span>{MARKETING.brand.name}</span>
      </div>

      {pathname === "/" && (
        <nav
          className="marketing-section-rail"
          aria-label={marketingText(lang, MARKETING.motion.railLabel)}
        >
          {MARKETING.motion.sectionLinks.map((item, index) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? "is-active" : undefined}
              aria-label={marketingText(lang, item.label)}
              aria-current={activeSection === item.id ? "location" : undefined}
            >
              {String(index + 1).padStart(2, "0")}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
