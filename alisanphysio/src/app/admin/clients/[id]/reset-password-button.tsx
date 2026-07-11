"use client";

import { useState } from "react";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { resetClientPassword } from "@/app/admin/actions";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function ResetPasswordButton({
  clientId,
}: {
  clientId: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
      >
        {t("admin.resetPassword")}
      </button>
      {open && (
        <ResetModal clientId={clientId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ResetModal({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("reset.tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setPending(true);
    const res = await resetClientPassword({ clientId, password });
    if (res.ok) {
      toast(t("toast.passwordUpdated"));
      onClose();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-foreground">
          {t("reset.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("reset.subtitle")}</p>

        <form onSubmit={submit} autoComplete="off" className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("reset.newPassword")}
            </label>
            <input
              type="text"
              autoComplete="off"
              name="new-client-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("reset.confirm")}
            </label>
            <input
              type="text"
              autoComplete="off"
              name="confirm-client-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t("reset.updating") : t("reset.update")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
