/**
 * Lightweight theme handling for AlisanPhysio (light / dark).
 * Framework-agnostic constants + a client cookie setter. The server resolver
 * lives in theme-server.ts; the header toggle lives at src/app/theme-toggle.tsx.
 *
 * Behavior: with no cookie we follow the OS `prefers-color-scheme` (resolved
 * pre-paint by the inline script in the root layout). The header toggle writes
 * an explicit choice to the `theme` cookie, which then wins on every load.
 */

export type Theme = "light" | "dark";
export const THEME_COOKIE = "theme";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark";
}

/** Persist the explicit theme choice in a cookie (client-side). */
export function setThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Inline script (runs synchronously in <head>, before first paint) that adds
 * the `.dark` class to <html> based on the cookie, falling back to the OS
 * preference. This is what prevents a flash of the wrong theme on load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(dark|light)/);var t=m?m[1]:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');if(t==='dark'){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})();`;
