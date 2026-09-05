"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n-provider";
import type { CatalogClient } from "@/lib/catalog-programs";
import { isMonthStart } from "@/lib/month";
import { assignCatalogProgram, getCatalogClientMonths } from "./actions";

export default function CatalogAssignForm({ sourceId, clients, initialClientId = "" }: {
  sourceId: string; clients: CatalogClient[]; initialClientId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId);
  const [month, setMonth] = useState("");
  const [months, setMonths] = useState<{ clientId: string; used: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const loaded = months?.clientId === clientId;
  const date = `${month}-01`;
  const taken = loaded && months.used.includes(date);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    getCatalogClientMonths(clientId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setMonths({ clientId, used: result.usedMonths });
        setMonth((current) => current || result.suggestedMonth.slice(0, 7));
        setError(null);
      } else setError(result.error);
    }).catch(() => { if (!cancelled) setError(t("catalog.loadMonthsError")); });
    return () => { cancelled = true; };
  }, [clientId, retry, t]);

  function selectClient(value: string) {
    setClientId(value); setMonths(null); setMonth(""); setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!clientId || !loaded || taken || !isMonthStart(date) || saving) return;
    setSaving(true); setError(null);
    try {
      const result = await assignCatalogProgram({ sourceId, clientId, monthStartDate: date });
      if (result.ok) { router.push(result.href); router.refresh(); }
      else {
        setError(result.error);
        if (result.monthTaken) setMonths((current) => current ? { ...current, used: [...current.used, date] } : current);
      }
    } catch { setError(t("catalog.copyError")); }
    finally { setSaving(false); }
  }

  const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50";
  return <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-7">
    <p className="text-sm leading-relaxed text-muted-foreground">{t("catalog.snapshot")}</p>
    {clients.length === 0 && <p className="text-sm text-muted-foreground">{t("catalog.noClients")}</p>}
    <label className="block text-sm font-semibold text-foreground">{t("catalog.client")}
      <select required value={clientId} disabled={saving || clients.length === 0} onChange={(e) => selectClient(e.target.value)} className={inputClass}>
        <option value="">{t("catalog.client")}</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.full_name || t("catalog.unnamedClient")}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold text-foreground">{t("editor.month")}
      <input type="month" required min="1000-01" max="9999-12" value={month} disabled={!loaded || saving} onChange={(e) => { setMonth(e.target.value); setError(null); }} className={inputClass} aria-describedby="catalog-month-status" aria-invalid={Boolean(taken)} />
    </label>
    <div id="catalog-month-status" aria-live="polite" className="text-sm">
      {clientId && !loaded && !error && <p className="text-muted-foreground">{t("catalog.checkingMonths")}</p>}
      {taken && <p className="text-danger">{t("err.programMonthTaken")}</p>}
    </div>
    {error && !taken && <p role="alert" className="text-sm text-danger">{error}</p>}
    {error && !loaded && <button type="button" onClick={() => { setError(null); setRetry((value) => value + 1); }} className="min-h-11 text-sm font-semibold text-brand">{t("catalog.retry")}</button>}
    <button type="submit" disabled={!clientId || !loaded || taken || !isMonthStart(date) || saving} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-solid px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-solid-hover disabled:opacity-50 sm:w-auto">
      {saving ? t("catalog.assigning") : t("catalog.assignAndEdit")}
    </button>
  </form>;
}
