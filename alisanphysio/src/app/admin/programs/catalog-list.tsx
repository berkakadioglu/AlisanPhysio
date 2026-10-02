"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Copy, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import type { CatalogListItem } from "@/lib/catalog-programs";
import { deleteCatalogProgram, duplicateCatalogProgram } from "./actions";

export default function CatalogList({ programs, clientId, timeZone }: {
  programs: CatalogListItem[]; clientId?: string; timeZone: string;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const visible = programs.filter((p) => !removed.includes(p.id) && p.title.toLocaleLowerCase(lang).includes(search.trim().toLocaleLowerCase(lang)));
  const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-pill disabled:opacity-50";

  async function duplicate(id: string) {
    setBusy(id); setError(null);
    try {
      const result = await duplicateCatalogProgram(id);
      if (result.ok) { router.push(`/admin/programs/${result.programId}/edit`); router.refresh(); }
      else setError(result.error);
    } catch { setError(t("catalog.copyError")); }
    finally { setBusy(null); }
  }

  async function remove(program: CatalogListItem) {
    if (!window.confirm(t("catalog.confirmDelete", { title: program.title }))) return;
    setBusy(program.id); setError(null);
    try {
      const result = await deleteCatalogProgram(program.id);
      if (result.ok) { setRemoved((ids) => [...ids, program.id]); router.refresh(); }
      else setError(result.error);
    } catch { setError(t("catalog.deleteError")); }
    finally { setBusy(null); }
  }

  return <>
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-display text-3xl font-extrabold text-foreground">{t("catalog.heading")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("catalog.intro")}</p></div>
      <Link href="/admin/programs/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-solid-hover"><Plus className="h-4 w-4" aria-hidden />{t("catalog.create")}</Link>
    </header>
    <label className="mt-7 flex max-w-lg items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("catalog.search")}</span>
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("catalog.search")} className="min-w-0 w-full bg-transparent text-sm text-foreground outline-none" />
    </label>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {visible.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{search.trim() ? t("catalog.noMatches") : t("catalog.empty")}</p>
    </div> : <ul className="mt-6 space-y-4">
      {visible.map((program) => <li key={program.id} className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-6">
        <article aria-label={program.title}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 break-words font-display text-xl font-bold text-foreground [overflow-wrap:anywhere]">{program.title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("catalog.updated")}{" "}
              {program.updated_at ? <time dateTime={program.updated_at}>{new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-CA", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(program.updated_at))}</time> : t("catalog.notRecorded")}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[[t("catalog.days"), program.dayCount], [t("catalog.exercises"), program.exerciseCount], [t("catalog.clients"), program.clientCount], [t("catalog.assignments"), program.assignmentCount]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-foreground">{value ?? t("catalog.notRecorded")}</dd></div>)}
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href={`/admin/programs/${program.id}/edit`} className={actionClass}><Pencil className="h-3.5 w-3.5 flex-none" aria-hidden />{t("common.edit")}</Link>
            <button type="button" disabled={busy !== null} onClick={() => duplicate(program.id)} className={actionClass}><Copy className="h-3.5 w-3.5 flex-none" aria-hidden />{t("catalog.duplicate")}</button>
            <Link href={`/admin/programs/${program.id}/assign${clientId ? `?client=${clientId}` : ""}`} className={actionClass}><UserPlus className="h-3.5 w-3.5 flex-none" aria-hidden />{t("catalog.assign")}</Link>
            <button type="button" disabled={busy !== null} onClick={() => remove(program)} className={`${actionClass} text-danger`}><Trash2 className="h-3.5 w-3.5 flex-none" aria-hidden />{t("common.delete")}</button>
          </div>
        </article>
      </li>)}
    </ul>}
  </>;
}
