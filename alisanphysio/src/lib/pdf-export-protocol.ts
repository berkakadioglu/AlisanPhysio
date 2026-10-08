/**
 * The contract between the "Save as PDF" button and the export routes. Pure
 * (no Node, no React, no DOM access at import time) so both sides share it.
 *
 * Saved programmes / saved days download by NAVIGATING to the GET route inside
 * the user's tap (no fetch, no blob): iOS / iPadOS WebKit only honours a
 * download that starts in the gesture, and the server's Content-Disposition
 * gives the file its name. A navigation can't report back, so the button adds
 * a random token and the route answers with a short-lived cookie named after
 * it: "ok" once the PDF is on its way, "fail" (with an empty 204, which leaves
 * the page as it is) when it could not be produced.
 */

export type ExportResult = "ok" | "fail";
export type SavedExportMode = "program" | "template";

/** Tokens are client-generated: accept only short, URL- and cookie-safe ones. */
export const EXPORT_TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** Site-wide, so the button can read it on whichever page it sits. */
export const EXPORT_COOKIE_PATH = "/";
/** The cookie only has to outlive one render (the route caps renders at 60 s). */
export const EXPORT_COOKIE_MAX_AGE = 120;

export function isExportToken(value: unknown): value is string {
  return typeof value === "string" && EXPORT_TOKEN_RE.test(value);
}

export function exportCookieName(token: string): string {
  return `pdf-export-${token}`;
}

/** The download URL for a saved programme / saved day. */
export function savedExportUrl(
  mode: SavedExportMode,
  id: string,
  lang: string,
  token: string,
): string {
  const query = new URLSearchParams({ lang, download: "1", token });
  return `/admin/export/${mode}/${encodeURIComponent(id)}?${query}`;
}

/** The result the route left for `token` in a `document.cookie` string. */
export function readExportResult(cookies: string, token: string): ExportResult | null {
  const name = `${exportCookieName(token)}=`;
  for (const part of cookies.split(";")) {
    const pair = part.trim();
    if (!pair.startsWith(name)) continue;
    const value = pair.slice(name.length);
    return value === "ok" || value === "fail" ? value : null;
  }
  return null;
}

/** The filename from a Content-Disposition header (RFC 5987 form first). */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1];
  if (extended) {
    try {
      return decodeURIComponent(extended.trim());
    } catch {
      // fall through to the plain parameter
    }
  }
  return /filename\s*=\s*"([^"]+)"/i.exec(header)?.[1] ?? /filename\s*=\s*([^;\s]+)/i.exec(header)?.[1] ?? null;
}

/**
 * iOS / iPadOS WebKit (Safari, and Chrome / Edge / Firefox on iPad, which all
 * use it). iPadOS Safari presents itself as a Mac, so the rule is the one
 * Apple's own guidance implies: an Apple platform with more than one touch
 * point. No user-agent string parsing.
 */
export function isAppleTouchDevice(
  nav: { maxTouchPoints?: number; platform?: string } | undefined,
): boolean {
  if (!nav) return false;
  return (nav.maxTouchPoints ?? 0) > 1 && /^(Mac|iPad|iPhone|iPod)/.test(nav.platform ?? "");
}
