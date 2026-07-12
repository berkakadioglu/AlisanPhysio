"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { setThemeCookie, type Theme } from "@/lib/theme";
import { useI18n } from "./i18n-provider";

/**
 * Light/dark toggle that sits next to the language toggle. The theme itself is
 * applied pre-paint by the inline script in the root layout (cookie → OS
 * preference); this button just mirrors the current `.dark` class on <html> and
 * flips it on click, persisting the explicit choice to the `theme` cookie. Pure
 * CSS re-theme — no navigation/refresh needed.
 *
 * We read the current theme via useSyncExternalStore + a MutationObserver so the
 * icon stays in sync without a setState-in-effect, and hydration matches the
 * server (which can't know the client class → getServerSnapshot returns light).
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}
function getServerSnapshot(): boolean {
  return false;
}

export default function ThemeToggle() {
  const { t } = useI18n();
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    setThemeCookie(next);
  }

  const label = isDark ? t("theme.toLight") : t("theme.toDark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition hover:text-foreground"
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
