"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { dragTarget } from "./dose";

/** Pixels the pointer must travel before a press on the handle becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Distance from the viewport edge where dragging starts to auto-scroll. */
const SCROLL_EDGE = 72;
const SCROLL_MAX_SPEED = 18;

/** A live drag. Positions are document coordinates measured when it started. */
interface DragState {
  key: string;
  from: number;
  to: number;
  /** How far the dragged row has moved (clamped to the list). */
  dy: number;
  startDocY: number;
  tops: number[];
  heights: number[];
  /** The list's document top (to place the drop indicator). */
  listTop: number;
}

interface Pending {
  key: string;
  index: number;
  pointerId: number;
  startClientY: number;
  handle: HTMLElement;
}

export type MoveSource = "pointer" | "keyboard";

/**
 * Drag-and-drop + keyboard reordering for a vertical list, without a library.
 *
 * Pointer: press the handle (pointer capture, `touch-action: none`), drag past
 * a small threshold, the row follows the pointer while the rows it passes
 * slide out of the way, and a drop indicator marks the slot. Releasing
 * commits via `onMove(from, to)`; Escape or pointercancel aborts. The page
 * auto-scrolls near the viewport edges.
 *
 * Keyboard: ArrowUp / ArrowDown on a focused handle moves the row one place
 * immediately and keeps focus on that row's handle after the re-render.
 */
export function useSortable({
  keys,
  onMove,
}: {
  keys: string[];
  onMove: (from: number, to: number, source: MoveSource) => void;
}) {
  const items = useRef(new Map<string, HTMLElement>());
  const handles = useRef(new Map<string, HTMLElement>());
  const list = useRef<HTMLElement | null>(null);
  const pending = useRef<Pending | null>(null);
  const live = useRef<DragState | null>(null);
  const lastClientY = useRef(0);
  const focusAfterMove = useRef<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const update = (next: DragState | null) => {
    live.current = next;
    setDrag(next);
  };

  /** Recompute the drag for a pointer at `clientY` (also after auto-scroll). */
  const follow = (clientY: number) => {
    const d = live.current;
    if (!d) return;
    const docY = clientY + window.scrollY;
    // Clamped to the list; the slot is found with the row's leading edge.
    const { dy, to } = dragTarget(d.tops, d.heights, d.from, docY - d.startDocY);
    if (dy !== d.dy || to !== d.to) update({ ...d, dy, to });
  };

  const end = (commit: boolean) => {
    const d = live.current;
    const p = pending.current;
    pending.current = null;
    if (p?.handle.hasPointerCapture(p.pointerId)) p.handle.releasePointerCapture(p.pointerId);
    if (!d) return;
    update(null);
    if (commit && d.to !== d.from) onMove(d.from, d.to, "pointer");
  };

  const active = drag != null;

  // While dragging: Escape cancels, and the page auto-scrolls near the edges.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const p = pending.current;
        pending.current = null;
        if (p?.handle.hasPointerCapture(p.pointerId)) p.handle.releasePointerCapture(p.pointerId);
        live.current = null;
        setDrag(null);
      }
    };
    let frame = 0;
    const tick = () => {
      const y = lastClientY.current;
      const h = window.innerHeight;
      const speed =
        y < SCROLL_EDGE
          ? -((SCROLL_EDGE - y) / SCROLL_EDGE) * SCROLL_MAX_SPEED
          : y > h - SCROLL_EDGE
            ? ((y - (h - SCROLL_EDGE)) / SCROLL_EDGE) * SCROLL_MAX_SPEED
            : 0;
      if (speed !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, speed);
        if (window.scrollY !== before && live.current) {
          // Same maths as `follow` (shared dragTarget), without its stale closure.
          const d = live.current;
          const docY = y + window.scrollY;
          const { dy, to } = dragTarget(d.tops, d.heights, d.from, docY - d.startDocY);
          live.current = { ...d, dy, to };
          setDrag(live.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  // Keyboard moves re-render the list in a new order; put focus back on the
  // moved row's handle (React may have detached and re-inserted it).
  useLayoutEffect(() => {
    const key = focusAfterMove.current;
    if (!key) return;
    focusAfterMove.current = null;
    const el = handles.current.get(key);
    if (el && document.activeElement !== el) el.focus();
  });

  function start(p: Pending, clientY: number) {
    const els = keys.map((k) => items.current.get(k));
    if (els.some((el) => !el) || !list.current) return false;
    const scrollY = window.scrollY;
    const rects = els.map((el) => el!.getBoundingClientRect());
    const tops = rects.map((r) => r.top + scrollY);
    const heights = rects.map((r) => r.height);
    update({
      key: p.key,
      from: p.index,
      to: p.index,
      dy: 0,
      startDocY: p.startClientY + scrollY,
      tops,
      heights,
      listTop: list.current.getBoundingClientRect().top + scrollY,
    });
    follow(clientY);
    return true;
  }

  /** Props for a row's drag handle (a <button>). */
  function handleProps(key: string, index: number) {
    return {
      ref: (el: HTMLElement | null) => {
        if (el) handles.current.set(key, el);
        else handles.current.delete(key);
      },
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (live.current) return;
        e.preventDefault(); // no text selection / native drag
        e.currentTarget.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        lastClientY.current = e.clientY;
        pending.current = {
          key,
          index,
          pointerId: e.pointerId,
          startClientY: e.clientY,
          handle: e.currentTarget,
        };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const p = pending.current;
        if (!p || p.pointerId !== e.pointerId) return;
        lastClientY.current = e.clientY;
        if (!live.current) {
          if (Math.abs(e.clientY - p.startClientY) < DRAG_THRESHOLD) return;
          if (!start(p, e.clientY)) pending.current = null;
          return;
        }
        follow(e.clientY);
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        if (pending.current?.pointerId !== e.pointerId) return;
        end(true);
      },
      onPointerCancel: () => end(false),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (live.current) return;
        const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
        if (to == null) return;
        e.preventDefault();
        if (to < 0 || to >= keys.length) return;
        focusAfterMove.current = key;
        onMove(index, to, "keyboard");
      },
    };
  }

  /** Ref for each sortable row element (measured when a drag starts). */
  function itemRef(key: string) {
    return (el: HTMLElement | null) => {
      if (el) items.current.set(key, el);
      else items.current.delete(key);
    };
  }

  /** Inline transform for a row while a drag is in progress. */
  function itemStyle(index: number): CSSProperties | undefined {
    if (!drag) return undefined;
    if (index === drag.from) {
      return { transform: `translate3d(0, ${drag.dy}px, 0)`, zIndex: 20, position: "relative" };
    }
    const h = drag.heights[drag.from];
    if (drag.from < drag.to && index > drag.from && index <= drag.to) {
      return { transform: `translate3d(0, ${-h}px, 0)` };
    }
    if (drag.to < drag.from && index >= drag.to && index < drag.from) {
      return { transform: `translate3d(0, ${h}px, 0)` };
    }
    return undefined;
  }

  /** Where the dragged row will land, relative to the list's top. */
  const indicator: CSSProperties | null = drag
    ? {
        top:
          (drag.to > drag.from
            ? drag.tops[drag.to] + drag.heights[drag.to] - drag.heights[drag.from]
            : drag.tops[drag.to]) - drag.listTop,
        height: drag.heights[drag.from],
      }
    : null;

  return {
    /** Ref for the list element (the indicator is positioned against its top). */
    listRef: (el: HTMLElement | null) => {
      list.current = el;
    },
    itemRef,
    itemStyle,
    handleProps,
    indicator,
    /** Whether a pointer drag is in progress. */
    active,
    /** Key of the row being dragged, or null. */
    draggingKey: drag?.key ?? null,
  };
}
