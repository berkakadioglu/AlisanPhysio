"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";

const enabledItems = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? []);

/** Tailwind w-60, used to keep the menu on screen. */
const MENU_WIDTH = 240;

export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
  Icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * A small "⋯" actions menu for the editor (secondary programme / day actions).
 * Opens on click; arrow keys / Home / End move between items, Escape closes and
 * returns focus to the trigger, an outside click or Tab closes it.
 */
export default function OverflowMenu({
  label,
  items,
  align = "right",
  className,
}: {
  /** Accessible name of the trigger, e.g. "More actions". */
  label: string;
  items: OverflowMenuItem[];
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // The side the menu opens towards: the preferred one, unless the trigger
  // sits so close to that viewport edge that the menu would leave the screen.
  const [side, setSide] = useState(align);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    enabledItems(menuRef.current)[0]?.focus();
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    let next = align;
    if (rect && align === "right" && rect.right < MENU_WIDTH + 8) next = "left";
    if (rect && align === "left" && window.innerWidth - rect.left < MENU_WIDTH + 8) next = "right";
    setSide(next);
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const list = enabledItems(menuRef.current);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === "ArrowDown") next = list[(index + 1) % list.length];
    else if (e.key === "ArrowUp") next = list[(index - 1 + list.length) % list.length];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    } else if (e.key === "Tab") {
      close(false);
      return;
    }
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  if (!items.length) return null;

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openMenu();
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <Ellipsis className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={`absolute ${
            side === "left" ? "left-0" : "right-0"
          } z-30 mt-1.5 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lift`}
        >
          {items.map(({ label: itemLabel, onSelect, Icon, danger, disabled }) => (
            <li key={itemLabel} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => {
                  close(true);
                  onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                  danger
                    ? "text-danger hover:bg-danger-tint focus-visible:bg-danger-tint"
                    : "text-foreground hover:bg-pill hover:text-brand focus-visible:bg-pill focus-visible:text-brand"
                }`}
              >
                {Icon && <Icon className="h-4 w-4 flex-none" aria-hidden />}
                <span className="min-w-0 [overflow-wrap:anywhere]">{itemLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
