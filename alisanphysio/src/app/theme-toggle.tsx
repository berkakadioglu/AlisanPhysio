"use client";

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
 * The icon pair is switched by CSS from the actual `.dark` class. Reading that
 * class at click time avoids stale hydration state when the server or pre-paint
 * script already selected dark mode.
 */
export default function ThemeToggle() {
  const { t } = useI18n();

  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    setThemeCookie(next);
  }

  const label = t("theme.toggle");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition hover:text-foreground"
    >
      <Moon className="h-4 w-4 dark:hidden" strokeWidth={2} aria-hidden />
      <Sun className="hidden h-4 w-4 dark:block" strokeWidth={2} aria-hidden />
    </button>
  );
}
