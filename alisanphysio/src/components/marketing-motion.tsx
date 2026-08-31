"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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
const REVEAL_SETTLE_MS = 1800;

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
  const selector = root.matches(".marketing-benefit")
    ? "svg *"
    : ".marketing-benefit > svg *";
  root
    .querySelectorAll<SVGGeometryElement>(selector)
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

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(".marketing");
    if (!root) return;
    const html = document.documentElement;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceMotion = motionQuery.matches;
    const revealItems = new Set<HTMLElement>();
    const counters = new Set<HTMLElement>();
    const counterCleanups = new Set<() => void>();
    const revealFrames = new Set<number>();
    const revealTimeouts = new Set<number>();
    let readyFrame = 0;
    let disposed = false;
    let failedOpen = false;
    let motionDisabled = false;
    let revealObserver: IntersectionObserver | null = null;
    let countObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let handleMotionPreference: ((event: MediaQueryListEvent) => void) | null =
      null;

    const showEverything = (markFallback = false) => {
      if (markFallback) {
        failedOpen = true;
        html.classList.add("marketing-motion-fallback");
      }
      delete html.dataset.marketingMotionReady;
      html.classList.remove("marketing-motion-enabled");
      root.classList.remove("marketing-motion-ready");
      revealFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      revealFrames.clear();
      revealTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      revealTimeouts.clear();
      counterCleanups.forEach((cleanup) => cleanup());
      counterCleanups.clear();
      root
        .querySelectorAll<HTMLElement>("[data-marketing-reveal]")
        .forEach((item) => {
          item.classList.remove("marketing-reveal-armed");
          item.classList.add("is-visible");
        });
      root
        .querySelectorAll<HTMLElement>("[data-marketing-count]")
        .forEach(finishCounter);
      prepareBenefitIcons(root, true);
    };

    const stopObservers = () => {
      revealObserver?.disconnect();
      countObserver?.disconnect();
      mutationObserver?.disconnect();
    };

    const failOpen = () => {
      if (failedOpen || disposed) return;
      stopObservers();
      showEverything(true);
    };

    if (
      reduceMotion ||
      html.classList.contains("marketing-motion-fallback") ||
      !("IntersectionObserver" in window) ||
      !("MutationObserver" in window)
    ) {
      showEverything();
      return;
    }

    const reveal = (item: HTMLElement) => {
      if (
        disposed ||
        failedOpen ||
        motionDisabled ||
        item.classList.contains("is-visible")
      ) {
        return;
      }

      // Only a node the runtime has registered can ever be hidden. If the
      // following frame stalls, this per-node watchdog removes the armed state.
      item.classList.add("marketing-reveal-armed");
      prepareBenefitIcons(item);
      const timeout = window.setTimeout(() => {
        revealTimeouts.delete(timeout);
        item.classList.remove("marketing-reveal-armed");
        item.classList.add("is-visible");
        prepareBenefitIcons(item, true);
      }, 700);
      revealTimeouts.add(timeout);

      const frame = window.requestAnimationFrame(() => {
        revealFrames.delete(frame);
        if (disposed || failedOpen) return;
        window.clearTimeout(timeout);
        revealTimeouts.delete(timeout);
        item.classList.add("is-visible");

        // The armed class exists only for the finite animation window. Once
        // that window closes, remove every hidden starting-state selector so
        // canceled CSS animations cannot strand nested headline or SVG parts.
        const settleTimeout = window.setTimeout(() => {
          revealTimeouts.delete(settleTimeout);
          item.classList.remove("marketing-reveal-armed");
          prepareBenefitIcons(item, true);
        }, REVEAL_SETTLE_MS);
        revealTimeouts.add(settleTimeout);
      });
      revealFrames.add(frame);
    };

    const registerReveal = (item: HTMLElement) => {
      if (revealItems.has(item)) return;
      revealItems.add(item);
      if (item.classList.contains("is-visible")) return;

      const rect = item.getBoundingClientRect();
      if (rect.bottom <= 0) {
        item.classList.add("is-visible");
      } else if (isWithinViewport(item)) {
        reveal(item);
      } else {
        // Offscreen content stays visible by default until the observer says it
        // is time to animate. A failed observer can therefore never blank it.
        revealObserver?.observe(item);
      }
    };

    const registerCounter = (counter: HTMLElement) => {
      if (counters.has(counter)) return;
      counters.add(counter);
      if (counterIsComplete(counter)) {
        finishCounter(counter);
      } else if (isWithinViewport(counter)) {
        counterCleanups.add(animateCounter(counter));
      } else {
        countObserver?.observe(counter);
      }
    };

    const registerTree = (tree: HTMLElement) => {
      if (tree.matches("[data-marketing-reveal]")) registerReveal(tree);
      tree
        .querySelectorAll<HTMLElement>("[data-marketing-reveal]")
        .forEach(registerReveal);
      if (tree.matches("[data-marketing-count]")) registerCounter(tree);
      tree
        .querySelectorAll<HTMLElement>("[data-marketing-count]")
        .forEach(registerCounter);
    };

    try {
      revealObserver = new IntersectionObserver(
        (entries) => {
          try {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              revealObserver?.unobserve(entry.target);
              reveal(entry.target as HTMLElement);
            });
          } catch {
            failOpen();
          }
        },
        { rootMargin: "0px 0px 14%", threshold: 0 },
      );
      countObserver = new IntersectionObserver(
        (entries) => {
          try {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              countObserver?.unobserve(entry.target);
              counterCleanups.add(
                animateCounter(entry.target as HTMLElement),
              );
            });
          } catch {
            failOpen();
          }
        },
        { rootMargin: "0px 0px 14%", threshold: 0 },
      );
      mutationObserver = new MutationObserver((records) => {
        try {
          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) registerTree(node);
            });
          });
        } catch {
          failOpen();
        }
      });
      mutationObserver.observe(root, { childList: true, subtree: true });
      registerTree(root);

      handleMotionPreference = (event: MediaQueryListEvent) => {
        if (!event.matches) return;
        motionDisabled = true;
        stopObservers();
        showEverything();
      };
      motionQuery.addEventListener("change", handleMotionPreference);

      // This class is a non-authoritative styling hook. The dataset flag is the
      // runtime-only readiness signal read by the inline watchdog.
      root.classList.add("marketing-motion-ready");
      readyFrame = window.requestAnimationFrame(() => {
        if (
          !disposed &&
          !failedOpen &&
          !motionDisabled &&
          !html.classList.contains("marketing-motion-fallback")
        ) {
          html.dataset.marketingMotionReady = "true";
        }
      });

    } catch {
      failOpen();
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(readyFrame);
      revealFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      revealTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      stopObservers();
      if (handleMotionPreference) {
        motionQuery.removeEventListener("change", handleMotionPreference);
      }
      counterCleanups.forEach((cleanup) => cleanup());
      Array.from(counters)
        .filter(
          (counter) => counter.dataset.marketingCountStarted === "true",
        )
        .forEach(finishCounter);
      revealItems.forEach((item) =>
        item.classList.remove("marketing-reveal-armed"),
      );
      prepareBenefitIcons(root, true);
      delete html.dataset.marketingMotionReady;
      html.classList.remove("marketing-motion-enabled");
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
