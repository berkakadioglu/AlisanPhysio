/**
 * Browser-side delivery for the "Save as PDF" button. Nothing here runs at
 * import time; every function touches the DOM only when called.
 *
 * Why it looks like this — iOS / iPadOS WebKit (Safari, and every iPad
 * browser) has two rules desktop browsers don't enforce:
 *  1. a download or a new window must start INSIDE the user's tap — after an
 *     `await` (our PDFs take seconds to render) the tap no longer counts;
 *  2. an object URL is read asynchronously, after the click returns, so
 *     revoking it in the same tick cancels the download.
 * Saved exports therefore navigate to the GET route inside the tap (see
 * src/lib/pdf-export-protocol.ts); the unsaved-editor export opens its target
 * tab inside the tap and fills it when the PDF arrives; object URLs are only
 * revoked after REVOKE_AFTER_MS or when the page goes away.
 */
import {
  EXPORT_COOKIE_PATH,
  exportCookieName,
  readExportResult,
  type ExportResult,
} from "@/lib/pdf-export-protocol";

/** Long enough for any browser to have read the blob. */
export const REVOKE_AFTER_MS = 60_000;

const liveUrls = new Set<string>();
let pagehideBound = false;

function revokeNow(url: string): void {
  if (liveUrls.delete(url)) URL.revokeObjectURL(url);
}

/** Revoke an object URL later — never in the tick that handed it out. */
export function revokeLater(url: string, ms: number = REVOKE_AFTER_MS): void {
  liveUrls.add(url);
  setTimeout(() => revokeNow(url), ms);
  if (!pagehideBound) {
    pagehideBound = true;
    window.addEventListener("pagehide", () => {
      for (const u of [...liveUrls]) revokeNow(u);
    });
  }
}

/** Desktop download of a ready blob (the server's filename, no navigation). */
export function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  revokeLater(href);
}

/**
 * Open the tab the PDF will appear in. MUST be called synchronously inside the
 * tap (rule 1 above). Shows a short "Preparing…" note until the PDF arrives.
 * Returns null when the browser refused to open a window.
 */
export function openPendingWindow(message: string, title: string): Window | null {
  const win = window.open("", "_blank");
  if (!win) return null;
  try {
    const doc = win.document;
    doc.title = title;
    const note = doc.createElement("p");
    note.textContent = message;
    note.style.cssText =
      "font:16px -apple-system,system-ui,sans-serif;color:#475569;text-align:center;margin:40vh 16px 0";
    doc.body.appendChild(note);
  } catch {
    // The note is cosmetic; the PDF still loads into the window.
  }
  return win;
}

/** Point a window opened by openPendingWindow at the finished PDF. */
export function showBlobIn(win: Window, blob: Blob, filename: string): void {
  // A File (not a bare Blob) carries the filename for viewers that use it.
  const href = URL.createObjectURL(new File([blob], filename, { type: "application/pdf" }));
  win.location.replace(href);
  revokeLater(href);
}

/** Open a ready PDF in a new tab from a FRESH tap (the toast's "Open" action). */
export function openBlobInNewTab(blob: Blob, filename: string): boolean {
  const href = URL.createObjectURL(new File([blob], filename, { type: "application/pdf" }));
  const win = window.open(href, "_blank");
  revokeLater(href);
  return win !== null;
}

/** A random token for one saved-export navigation (URL- and cookie-safe). */
export function newExportToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Wait for the export route's result cookie (a navigation is the only way a
 * saved export can start inside the tap, and it can't report back otherwise).
 * Resolves "ok" / "fail", or "timeout" when nothing arrives in time; cancel()
 * stops polling for good (the promise then never settles).
 */
export function watchExportResult(
  token: string,
  { timeoutMs = 90_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): { promise: Promise<ExportResult | "timeout">; cancel: () => void } {
  let timer: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  const promise = new Promise<ExportResult | "timeout">((resolve) => {
    const started = Date.now();
    timer = setInterval(() => {
      if (cancelled) return;
      const result = readExportResult(document.cookie, token);
      if (result || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        document.cookie = `${exportCookieName(token)}=; Max-Age=0; Path=${EXPORT_COOKIE_PATH}`;
        resolve(result ?? "timeout");
      }
    }, intervalMs);
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
      clearInterval(timer);
    },
  };
}

/**
 * Is the staff session still valid? true / false, or null when the probe
 * itself failed (offline) — callers then carry on rather than block.
 */
export async function checkExportSession(): Promise<boolean | null> {
  try {
    const res = await fetch("/admin/export/session", { cache: "no-store", credentials: "same-origin" });
    return res.status === 204 && !res.redirected;
  } catch {
    return null;
  }
}
