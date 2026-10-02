"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "success" | "error";

/** An optional inline action (e.g. "Undo") shown on the toast. */
export interface ToastAction {
  label: string;
  /** Runs once; the toast closes as soon as it is clicked. */
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** How long the toast stays up (ms). Defaults depend on the variant. */
  durationMs?: number;
}

/** `toast(msg)` is a success toast; `toast.error(msg)` an error one. */
export interface ToastFn {
  (message: string, options?: ToastOptions): void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

/** Errors stay up longer — they're read, not glanced at. */
const DURATION_MS: Record<ToastVariant, number> = { success: 3000, error: 6000 };
/** A toast with an action (Undo) must stay long enough to reach the button. */
export const UNDO_TOAST_MS = 10_000;

function makeToastFn(
  show: (message: string, variant: ToastVariant, options?: ToastOptions) => void,
): ToastFn {
  const fn = ((message: string, options?: ToastOptions) => show(message, "success", options)) as ToastFn;
  fn.success = (message, options) => show(message, "success", options);
  fn.error = (message, options) => show(message, "error", options);
  return fn;
}

const ToastContext = createContext<ToastFn>(makeToastFn(() => {}));

/** Show a brief toast. Available anywhere under the root layout. */
export function useToast(): ToastFn {
  return useContext(ToastContext);
}

let seq = 0;
/** Auto-dismiss timers by toast id (one provider per app, like `seq`). */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant, options?: ToastOptions) => {
      const id = ++seq;
      setToasts((t) => [...t, { id, message, variant, action: options?.action }]);
      const duration =
        options?.durationMs ?? (options?.action ? UNDO_TOAST_MS : DURATION_MS[variant]);
      timers.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  const toast = useMemo(() => makeToastFn(show), [show]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
        {toasts.map((t) => {
          const isError = t.variant === "error";
          return (
            <div
              key={t.id}
              role={isError ? "alert" : "status"}
              data-variant={t.variant}
              className={`animate-toast-in pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lift ${
                isError ? "bg-danger-solid" : "bg-brand-solid"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="mt-0.5 h-4 w-4 flex-none"
              >
                {isError ? (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </>
                ) : (
                  <path d="M20 6 9 17l-5-5" />
                )}
              </svg>
              <span className="min-w-0 [overflow-wrap:anywhere]">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(t.id);
                    t.action?.onClick();
                  }}
                  className="-my-1 ml-1 flex-none rounded-lg px-2 py-1 text-sm font-bold underline decoration-white/60 underline-offset-2 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
