"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import type { Membership } from "@/lib/membership";
import type { Role } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import LanguageSelect from "@/app/admin/language-select";
import MembershipSelect from "@/app/admin/membership-select";
import RoleSelect from "@/app/admin/role-select";
import { assignRole, deleteClient, updateClient } from "@/app/admin/actions";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function ManageClientButton({
  clientId,
  fullName,
  email,
  language,
  height,
  membership,
  membershipEndDate,
  role,
  isAdmin,
  isSelf,
  defaultOpen = false,
}: {
  clientId: string;
  fullName: string;
  email: string;
  language: Lang;
  height: number | null;
  membership: Membership | null;
  membershipEndDate: string | null;
  role: Role;
  isAdmin: boolean;
  isSelf: boolean;
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const pathname = usePathname();

  function close() {
    setOpen(false);
    router.replace(pathname);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
      >
        {t("admin.manage")}
      </button>
      {open && (
        <ManageModal
          clientId={clientId}
          initialName={fullName}
          initialEmail={email}
          initialLang={language}
          initialHeight={height != null ? String(height) : ""}
          initialMembership={membership}
          initialEndDate={membershipEndDate ?? ""}
          initialRole={role}
          isAdmin={isAdmin}
          isSelf={isSelf}
          onClose={close}
        />
      )}
    </>
  );
}

function ManageModal({
  clientId,
  initialName,
  initialEmail,
  initialLang,
  initialHeight,
  initialMembership,
  initialEndDate,
  initialRole,
  isAdmin,
  isSelf,
  onClose,
}: {
  clientId: string;
  initialName: string;
  initialEmail: string;
  initialLang: Lang;
  initialHeight: string;
  initialMembership: Membership | null;
  initialEndDate: string;
  initialRole: Role;
  isAdmin: boolean;
  isSelf: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [language, setLanguage] = useState<Lang>(initialLang);
  const [height, setHeight] = useState(initialHeight);
  const [membership, setMembership] = useState<Membership | null>(initialMembership);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Delete flow
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await updateClient({
      clientId,
      fullName: name,
      email,
      language,
      height,
      membership,
      membershipEndDate: endDate,
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    // Role changes go through the admin-only action (separate from staff fields).
    if (isAdmin && !isSelf && role !== initialRole) {
      const roleRes = await assignRole({ userId: clientId, role });
      if (!roleRes.ok) {
        setError(roleRes.error);
        setPending(false);
        return;
      }
    }
    toast(t("toast.clientUpdated"));
    router.refresh();
    onClose();
  }

  async function doDelete() {
    setDeleteError(null);
    setDeleting(true);
    const res = await deleteClient({ clientId });
    if (res.ok) {
      toast(t("toast.clientDeleted"));
      router.push("/admin");
      router.refresh();
    } else {
      setDeleteError(res.error);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-foreground">
          {t("manage.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("manage.subtitle")}</p>

        <form onSubmit={submit} autoComplete="off" className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("manage.fullName")}
            </label>
            <input
              type="text"
              autoComplete="off"
              name="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Deniz Aydın"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("manage.email")}
            </label>
            <input
              type="email"
              autoComplete="off"
              name="client-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="name@alisanphysio.local"
            />
            <p className="text-xs text-subtle-foreground">{t("manage.emailHint")}</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("profile.height")}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="50"
              max="260"
              name="client-height"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={`${inputClass} max-w-40`}
              placeholder="170"
            />
            <p className="text-xs text-subtle-foreground">{t("profile.heightHint")}</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("lang.label")}
            </label>
            <LanguageSelect value={language} onChange={setLanguage} />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {t("manage.role")}
              </label>
              <RoleSelect value={role} onChange={setRole} disabled={isSelf} />
              {isSelf && (
                <p className="text-xs text-subtle-foreground">
                  {t("err.cantChangeOwnRole")}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("membership.label")}
            </label>
            <MembershipSelect value={membership} onChange={setMembership} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("membership.endDate")}
            </label>
            <input
              type="date"
              name="membership-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={membership === null}
              className={`${inputClass} max-w-52 disabled:cursor-not-allowed disabled:opacity-50`}
            />
            <p className="text-xs text-subtle-foreground">
              {t("membership.endDateHint")}
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
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
              className="rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t("common.saving") : t("manage.save")}
            </button>
          </div>
        </form>

        {/* Danger zone — permanent delete, behind an explicit confirm.
            ADMIN ONLY: managers never see this (and deleteClient is requireAdmin). */}
        {isAdmin && (
        <div className="mt-6 border-t border-border pt-5">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-xl border border-danger-border px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger-tint"
            >
              {t("manage.deleteClient")}
            </button>
          ) : (
            <div className="rounded-xl border border-danger-border bg-danger-tint p-4">
              <p className="font-display text-sm font-bold text-danger">
                {t("manage.deleteHeading")}
              </p>
              <p className="mt-1.5 text-sm text-danger">
                {t("manage.deleteWarning")}
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm text-danger">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--danger-solid)]"
                />
                <span>{t("manage.deleteConfirmCheck")}</span>
              </label>

              {deleteError && (
                <p role="alert" className="mt-2 text-sm font-medium text-danger">
                  {deleteError}
                </p>
              )}

              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setAck(false);
                    setDeleteError(null);
                  }}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger-tint-hover"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={!ack || deleting}
                  className="rounded-xl bg-danger-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-danger-solid-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? t("manage.deleting") : t("manage.deleteConfirm")}
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
