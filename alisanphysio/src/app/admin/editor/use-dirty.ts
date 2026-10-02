"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { createLeaveGuard, isPlainLeftClick, type LeaveGuard } from "./leave-guard";

/**
 * Guard against losing unsaved edits while `dirty`: closing / reloading the
 * tab (`beforeunload`), clicking any same-origin link to another page (the
 * admin header nav, the back link…) and the browser Back button. See
 * leave-guard.ts for how the history part works.
 *
 * Returns `release()`: await it right before the editor navigates or
 * refreshes by itself (router.push / replace / refresh), so that applies to
 * the editor's own history entry (the popped guard entry is marked spent).
 *
 * `suspended`: never arm (the first save is moving to the edit URL — a guard
 * entry pushed now would be left behind at the "new" URL).
 */
export function useLeaveGuard(
  dirty: boolean,
  message: string,
  suspended = false,
): () => Promise<void> {
  const dirtyRef = useRef(dirty);
  const messageRef = useRef(message);
  const guardRef = useRef<LeaveGuard | null>(null);
  // Bumped after each release() so the arm effect re-checks the COMMITTED
  // dirty state (edits made while a save was in flight re-arm the guard).
  const [armEpoch, setArmEpoch] = useState(0);
  useLayoutEffect(() => {
    dirtyRef.current = dirty;
    messageRef.current = message;
  });

  // Declared first so it runs before the arm effect below on mount.
  useEffect(() => {
    const guard = createLeaveGuard(
      {
        history: window.history,
        location: window.location,
        canGoBack,
        confirm: (text) => window.confirm(text),
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id as number),
      },
      { isDirty: () => dirtyRef.current, message: () => messageRef.current },
    );
    guardRef.current = guard;

    const onPopState = (e: PopStateEvent) => guard.onPopState(e.state);
    // Capture phase on window: runs before React's root listener, so a
    // cancelled click never reaches next/link's onClick either.
    const onClick = (e: MouseEvent) => {
      if (!isPlainLeftClick(e) || !(e.target instanceof Element)) return;
      const a = e.target.closest("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const allow = guard.onLinkClick({
        href: a.href,
        target: a.target,
        download: a.hasAttribute("download"),
      });
      if (!allow) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("click", onClick, true);
      guard.dispose();
      guardRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (dirty && !suspended) guardRef.current?.arm();
  }, [dirty, suspended, armEpoch]);

  // Every render: router.refresh() / a revalidating server action re-renders
  // the editor (new server props) in the same commit in which Next rewrote the
  // history entry and dropped our marker — put it back (no-op otherwise).
  useEffect(() => {
    guardRef.current?.restamp();
  });

  useEffect(() => {
    if (!dirty) return;
    // Only while dirty: a beforeunload listener keeps some browsers from
    // using the back/forward cache.
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (guardRef.current && !guardRef.current.shouldWarnOnUnload()) return;
      e.preventDefault();
      // Legacy browsers only show the prompt when returnValue is set.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return useCallback(async () => {
    await guardRef.current?.release();
    setArmEpoch((n) => n + 1);
  }, []);
}

/**
 * Whether this tab has an entry before the current one. The Navigation API
 * knows; elsewhere `history.length > 1` is the best guess (wrong only when
 * the first entry has Forward entries after it).
 */
function canGoBack(): boolean {
  const nav = (window as unknown as { navigation?: { canGoBack?: unknown } }).navigation;
  return typeof nav?.canGoBack === "boolean" ? nav.canGoBack : window.history.length > 1;
}

/**
 * Ctrl+S / Cmd+S runs `onSave` instead of the browser's "Save page". Inside a
 * modal dialog (save day, insert saved day…) it is swallowed but does NOT save
 * the whole editor in the background.
 */
export function useSaveShortcut(onSave: () => void) {
  const run = useEffectEvent(onSave);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.target instanceof Element && e.target.closest('[aria-modal="true"]')) return;
        run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** "14:05" — 24-hour clock in both languages (the status line's "Saved at"). */
export function formatSavedTime(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
