/**
 * Unsaved-changes guard for the editor — the framework-free core, so the
 * history logic is testable in Node (`useLeaveGuard` in use-dirty.ts wires it
 * to the real window).
 *
 * App Router navigations never fire `beforeunload`, so two extra guards:
 *
 * 1. LINKS: a capture-phase click listener on `window` (it runs before React's
 *    root listener, i.e. before next/link's onClick). A plain left click on a
 *    same-origin link to another page asks first; "Cancel" → preventDefault +
 *    stopPropagation, so neither Next nor the browser navigates. Cross-origin
 *    links are left to `beforeunload` (no double prompt).
 *
 * 2. BACK BUTTON: a popstate cannot be cancelled, and Next handles it before us.
 *    So the first edit pushes a SENTINEL entry with the same URL (no URL arg →
 *    Next's patched pushState keeps its own state and does not navigate). Back
 *    then only pops the sentinel — the same page, so the editor stays mounted —
 *    and we ask: "Stay" re-pushes the sentinel; "Leave" (or a clean editor)
 *    steps back once more, to where the user meant to go.
 *    `release()` pops the sentinel on purpose (no prompt) before the editor
 *    itself navigates (first save → edit URL, delete, assign) or refreshes, so
 *    the editor's own entry is the one that gets replaced. A popped sentinel
 *    stays in the FORWARD stack until the next push, so release() first marks
 *    it SPENT: a Forward onto a spent entry steps straight back (otherwise it
 *    would reopen e.g. the blank "new programme" editor after a first save).
 *    Only armed when the editor's entry has a back target (an editor opened
 *    in a new tab has none: Back stays disabled there, `beforeunload` covers
 *    closing the tab).
 *    Next rewrites the current entry's state on router.refresh() / revalidating
 *    server actions and drops custom keys — `restamp()` puts our marker back
 *    (useLeaveGuard calls it after every render and before a link leaves), so
 *    a later remount on the entry (Back from the page we left) still adopts it.
 *    Scroll: a history traversal restores the destination entry's saved scroll
 *    position. The editor's entry + sentinel use scrollRestoration "manual" while
 *    armed (popping the sentinel must not jump the page), and the entry is set
 *    back to "auto" before anything leaves it (new entries inherit the mode).
 */

/**
 * Marks our sentinel history entry (Next copies its own keys alongside):
 * `true` = a live sentinel, `"spent"` = one release() already popped.
 */
export const LEAVE_GUARD_STATE_KEY = "__editorLeaveGuard";
const SPENT = "spent";

/** Safety net: a release never waits longer than this for its popstate. */
const RELEASE_TIMEOUT_MS = 1000;
/** After the user agreed to leave, later prompts are skipped for this long. */
const LEAVING_GRACE_MS = 1500;

export interface LeaveGuardEnv {
  history: {
    readonly state: unknown;
    scrollRestoration: "auto" | "manual";
    pushState(data: unknown, unused: string): void;
    replaceState(data: unknown, unused: string): void;
    back(): void;
  };
  location: { readonly href: string };
  /** Whether the CURRENT entry has an earlier one in this tab to go back to. */
  canGoBack: () => boolean;
  confirm: (message: string) => boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

export interface LinkInfo {
  /** Resolved href of the clicked <a>. */
  href: string;
  /** Its `target` attribute ("" when absent). */
  target: string;
  /** Whether it has a `download` attribute. */
  download: boolean;
}

/** A click that would follow a link in the same tab (no modifiers, left button). */
export function isPlainLeftClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    e.button === 0 && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}

/**
 * Whether following `link` from `currentHref` is a client-side page change we
 * must guard: same origin, same tab, http(s), and a different path or query
 * (a #hash on the same page is not leaving).
 */
export function leavesPage(link: LinkInfo, currentHref: string): boolean {
  if (link.download) return false;
  if (link.target && link.target.toLowerCase() !== "_self") return false;
  let to: URL;
  let from: URL;
  try {
    from = new URL(currentHref);
    to = new URL(link.href, from);
  } catch {
    return false;
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return false; // mailto:, tel:, javascript:
  if (to.origin !== from.origin) return false; // a full unload → beforeunload asks
  return to.pathname !== from.pathname || to.search !== from.search;
}

const asRecord = (state: unknown): Record<string, unknown> =>
  typeof state === "object" && state !== null ? (state as Record<string, unknown>) : {};
const isSentinelState = (state: unknown) => asRecord(state)[LEAVE_GUARD_STATE_KEY] === true;
const isSpentState = (state: unknown) => asRecord(state)[LEAVE_GUARD_STATE_KEY] === SPENT;

export function createLeaveGuard(
  env: LeaveGuardEnv,
  opts: { isDirty: () => boolean; message: () => string },
) {
  // Mounting ON a sentinel (Back from a page we left via a link, or a reload):
  // adopt it, so a Back from here is handled like any other. A SPENT one is
  // never adopted (the editor we came from bounces a Forward onto it, see
  // onPopState; mounting here without that — e.g. via the history menu — just
  // shows the page, nothing to guard).
  let onSentinel = isSentinelState(env.history.state);
  let sentinelHref = onSentinel ? env.location.href : null;
  let leaving = false;
  let leavingTimer: unknown = null;
  /** Consumes the popstate a release() is waiting for. */
  let releasing: (() => void) | null = null;
  let pendingRelease: Promise<void> | null = null;

  function arm() {
    if (onSentinel) return;
    // No earlier entry (editor opened in a new tab): a sentinel would only
    // enable a Back that has nowhere to go after "Leave". Links +
    // beforeunload still guard; a cross-document Back hits beforeunload.
    if (!env.canGoBack()) return;
    // Before the push: the pushed sentinel inherits the mode.
    env.history.scrollRestoration = "manual";
    env.history.pushState({ [LEAVE_GUARD_STATE_KEY]: true }, "");
    onSentinel = true;
    sentinelHref = env.location.href;
  }

  /** Before leaving an entry: the next page's entry inherits the mode. */
  function restoreScrollMode() {
    env.history.scrollRestoration = "auto";
  }

  function markLeaving() {
    restoreScrollMode();
    leaving = true;
    if (leavingTimer !== null) env.clearTimeout(leavingTimer);
    // If the navigation never happens (e.g. a slow page that was abandoned), guard again.
    leavingTimer = env.setTimeout(() => {
      leaving = false;
      leavingTimer = null;
    }, LEAVING_GRACE_MS);
  }

  function onPopState(state: unknown) {
    if (isSpentState(state)) {
      // Forward onto a sentinel a release() popped (it is always the entry
      // right after an editor's own one): step back to that entry.
      env.history.back();
      return;
    }
    if (isSentinelState(state)) {
      // Forward onto a sentinel (or back onto one from a hash entry).
      onSentinel = true;
      sentinelHref = env.location.href;
      return;
    }
    if (!onSentinel) return; // an unrelated move; Next handles it
    onSentinel = false;
    // Popping the sentinel lands on the editor's own entry (same URL). A
    // different URL means e.g. a #hash entry — not the user leaving.
    if (env.location.href !== sentinelHref) return;
    if (releasing) {
      restoreScrollMode();
      const done = releasing;
      releasing = null;
      // Re-arming (if still dirty) is the caller's job once its state has
      // committed — see useLeaveGuard — so a stale "dirty" never re-pushes.
      done();
      return;
    }
    if (opts.isDirty() && !leaving && !env.confirm(opts.message())) {
      arm(); // stay — and catch the next Back too
      return;
    }
    markLeaving();
    env.history.back(); // the step the user actually asked for
  }

  /** false = block this link click. */
  function onLinkClick(link: LinkInfo): boolean {
    if (!leavesPage(link, env.location.href)) return true;
    if (!opts.isDirty() || leaving) {
      leaveByLink();
      return true;
    }
    if (!env.confirm(opts.message())) return false;
    markLeaving();
    restamp();
    return true;
  }

  function leaveByLink() {
    restoreScrollMode();
    // The entry we leave must still be recognisable when Back remounts us on it.
    restamp();
  }

  /**
   * Put our marker back on the sentinel when Next rewrote the entry's state
   * (router.refresh(), revalidating server actions). The state keeps Next's
   * `__NA`, so its patched replaceState passes it straight through (no URL →
   * no navigation).
   */
  function restamp() {
    if (!onSentinel || releasing || env.location.href !== sentinelHref) return;
    const state = env.history.state;
    if (isSentinelState(state) || isSpentState(state)) return;
    env.history.replaceState({ ...asRecord(state), [LEAVE_GUARD_STATE_KEY]: true }, "");
  }

  /** Whether `beforeunload` should ask (dirty, and not already agreed to leave). */
  function shouldWarnOnUnload() {
    return opts.isDirty() && !leaving;
  }

  /**
   * Pop our sentinel without a prompt, before the editor navigates by itself.
   * Resolves once the history is back on the editor's own entry.
   */
  function release(): Promise<void> {
    if (pendingRelease) return pendingRelease;
    if (!onSentinel) return Promise.resolve();
    pendingRelease = new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        pendingRelease = null;
        resolve();
      };
      const timer = env.setTimeout(finish, RELEASE_TIMEOUT_MS);
      // Kept set after a timeout so a late popstate is still swallowed.
      releasing = () => {
        env.clearTimeout(timer);
        finish();
      };
      // Mark it spent first: after the pop it lingers as a Forward entry.
      // (Even when Next wiped the marker: we know we are on our sentinel.)
      if (env.location.href === sentinelHref) {
        env.history.replaceState(
          { ...asRecord(env.history.state), [LEAVE_GUARD_STATE_KEY]: SPENT },
          "",
        );
      }
      env.history.back();
    });
    return pendingRelease;
  }

  function dispose() {
    if (onSentinel) restoreScrollMode();
    if (leavingTimer !== null) env.clearTimeout(leavingTimer);
    leavingTimer = null;
  }

  return { arm, onPopState, onLinkClick, shouldWarnOnUnload, release, restamp, dispose };
}

export type LeaveGuard = ReturnType<typeof createLeaveGuard>;
