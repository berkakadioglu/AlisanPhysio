"use client";

import { Minus, Plus } from "lucide-react";

const MAX_SETS = 99;

const stepBtn =
  "flex h-11 w-11 flex-none items-center justify-center text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/**
 * − [n] + stepper for the set count. Blank means "not specified" (null);
 * − stops at 1, + from blank starts at 1, and the field only accepts digits.
 */
export default function SetsStepper({
  value,
  onChange,
  id,
  labelledBy,
  inputLabel,
  decrementLabel,
  incrementLabel,
}: {
  value: number | null;
  onChange: (sets: number | null) => void;
  id?: string;
  /** id of the visible label, so the whole group is named by it */
  labelledBy?: string;
  inputLabel: string;
  decrementLabel: string;
  incrementLabel: string;
}) {
  const set = (n: number | null) => onChange(n == null ? null : Math.min(MAX_SETS, Math.max(1, n)));

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="inline-flex h-11 flex-none items-stretch overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={value == null || value <= 1}
        onClick={() => value != null && set(value - 1)}
        className={stepBtn}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={inputLabel}
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
          const n = digits ? Number.parseInt(digits, 10) : NaN;
          // 0 isn't a set count — treat it like a cleared field.
          onChange(Number.isFinite(n) && n >= 1 ? n : null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            set(value == null ? 1 : value + 1);
          } else if (e.key === "ArrowDown" && value != null) {
            e.preventDefault();
            set(value - 1);
          }
        }}
        placeholder="–"
        className="w-12 min-w-0 border-x border-border bg-transparent text-center text-base font-semibold tabular-nums text-foreground outline-none placeholder:text-subtle-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:text-sm"
      />
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={value != null && value >= MAX_SETS}
        onClick={() => set(value == null ? 1 : value + 1)}
        className={stepBtn}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
