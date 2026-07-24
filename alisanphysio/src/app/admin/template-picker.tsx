"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplateWithExercises } from "@/lib/types";

/**
 * A small dropdown menu of day templates. Picking one calls onPick(tpl).
 * Styling is caller-controlled via `buttonClassName` so it can match "+ Add
 * exercise" (the in-day control that fills the current day) or the bottom
 * "add as a new day" control. Closes on outside click.
 */
export default function TemplatePickerMenu({
  templates,
  onPick,
  label,
  buttonClassName,
  align = "left",
}: {
  templates: TemplateWithExercises[];
  onPick: (tpl: TemplateWithExercises) => void;
  label: string;
  buttonClassName: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={buttonClassName}
      >
        <span aria-hidden>▤</span> {label}
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </button>

      {open && (
        <ul
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } z-30 mt-1.5 max-h-72 w-64 overflow-auto rounded-xl border border-border bg-surface p-1.5 shadow-lift`}
        >
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(tpl);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-brand-tint hover:text-brand"
              >
                <span className="truncate font-medium">{tpl.title}</span>
                <span className="flex-none rounded-full bg-pill px-2 py-0.5 text-[11px] font-medium text-subtle-foreground tabular-nums">
                  {tpl.exercises.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
