"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientsCount, formatDay, programsCount, type Lang } from "@/lib/i18n";
import type { Membership } from "@/lib/membership";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import MembershipBadge from "@/components/membership-badge";
import LanguageSelect from "./language-select";
import { createClientAccount } from "./actions";

export interface AdminClient {
  id: string;
  name: string | null;
  email: string;
  programCount: number;
  membership: Membership | null;
  membershipEndDate: string | null;
}

export default function AdminClientsView({
  clients,
}: {
  clients: AdminClient[];
}) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {t("admin.clients")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {clientsCount(lang, clients.length)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>{" "}
          {t("admin.newClient")}
        </button>
      </div>

      <div className="mt-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.searchClients")}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <ul className="mt-6 space-y-3">
        {filtered.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/clients/${c.id}${c.name ? "" : "?manage=1"}`}
              className="group flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-tint font-display text-sm font-bold text-brand">
                {initials(c.name, c.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground group-hover:text-brand">
                  {c.name ?? (c.email || "—")}
                </p>
                {c.name ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {c.email}
                  </p>
                ) : (
                  <p className="truncate text-xs text-subtle-foreground">
                    {t("admin.addName")}
                  </p>
                )}
              </div>
              {c.membership && (
                <span className="flex flex-none items-center gap-1.5">
                  <MembershipBadge membership={c.membership} size="sm" />
                  {c.membershipEndDate && (
                    <span className="hidden text-[11px] text-subtle-foreground sm:inline">
                      {formatDay(c.membershipEndDate, lang)}
                    </span>
                  )}
                </span>
              )}
              <span className="flex-none rounded-full bg-pill px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {programsCount(lang, c.programCount)}
              </span>
              <span
                aria-hidden
                className="flex-none text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
              >
                →
              </span>
            </Link>
          </li>
        ))}

        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-10 text-center text-sm text-subtle-foreground">
            {clients.length === 0 ? t("admin.noClients") : t("admin.noClientMatches")}
          </li>
        )}
      </ul>

      {showNew && (
        <NewClientModal defaultLang={lang} onClose={() => setShowNew(false)} />
      )}
    </>
  );
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase();
  }
  return (email[0] ?? "?").toUpperCase();
}

function NewClientModal({
  defaultLang,
  onClose,
}: {
  defaultLang: Lang;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<Lang>(defaultLang);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await createClientAccount({ fullName, email, password, language });
    if (res.ok) {
      toast(t("toast.clientCreated"));
      router.refresh();
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
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-foreground">
          {t("newClient.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("newClient.subtitle")}
        </p>

        <form onSubmit={onSubmit} autoComplete="off" className="mt-5 space-y-4">
          <Field label={t("newClient.fullName")}>
            <input
              type="text"
              required
              autoComplete="off"
              name="client-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Deniz Aydın"
            />
          </Field>

          <Field label={t("newClient.username")} hint={t("newClient.usernameHint")}>
            <input
              type="email"
              required
              autoComplete="off"
              name="client-username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="deniz@alisanphysio.local"
            />
          </Field>

          <Field
            label={t("newClient.initialPassword")}
            hint={t("newClient.passwordHint")}
          >
            <input
              type="text"
              required
              autoComplete="off"
              name="client-initial-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>

          <Field label={t("lang.label")}>
            <LanguageSelect value={language} onChange={setLanguage} />
          </Field>

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
              {pending ? t("newClient.creating") : t("newClient.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-subtle-foreground">{hint}</p>}
    </div>
  );
}
