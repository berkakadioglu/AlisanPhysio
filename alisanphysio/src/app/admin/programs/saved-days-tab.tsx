"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  FolderOpen,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import ProgramExportButton from "@/components/program-export-button";
import { exercisesCount, formatDay, type Lang } from "@/lib/i18n";
import { localToday } from "@/lib/month";
import {
  SAVED_DAY_RETENTION_DAYS,
  SAVED_DAY_TITLE_MAX,
  savedDayNameKey,
  savedDayPurgeDate,
} from "@/lib/saved-days";
import type { TemplateSummary } from "@/lib/types";
import {
  deleteSavedDay,
  renameSavedDay,
  restoreSavedDay,
} from "../template-actions";

const editorHref = (id: string) => `/admin/programs/saved-days/${id}`;

/** A calendar date in the coach's timezone ("Oct 2, 2026" / "2 Eki 2026"). */
function dateLabel(iso: string, lang: Lang, timeZone: string): string {
  return formatDay(localToday(new Date(iso), timeZone), lang);
}

const iconButton =
  "flex h-10 w-10 flex-none items-center justify-center rounded-lg text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50";
const cardButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50";

/**
 * The "Saved days" tab of /admin/programs: live saved days (open in the
 * shared editor, rename, PDF, delete) and the collapsible "Recently deleted"
 * group (restore until the purge date). Deleting is soft and every delete has
 * Undo; the page purges expired rows before it renders this.
 */
export default function SavedDaysTab({
  live,
  deleted,
  timeZone,
}: {
  live: TemplateSummary[];
  deleted: TemplateSummary[];
  timeZone: string;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const searchId = useId();
  const deletedPanelId = useId();

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; variant: "table" | "card" } | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  // Optimistic state until router.refresh() brings the server's view:
  // id → deleted_at (null = live again) and id → new title.
  const [moved, setMoved] = useState<Record<string, string | null>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const byId = new Map<string, TemplateSummary>();
    for (const row of [...live, ...deleted]) byId.set(row.id, row);
    return [...byId.values()].map((row) => ({
      ...row,
      title: titles[row.id] ?? row.title,
      deleted_at: row.id in moved ? moved[row.id] : row.deleted_at,
    }));
  }, [live, deleted, moved, titles]);

  const liveRows = rows
    .filter((r) => !r.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.title.localeCompare(b.title, lang));
  const deletedRows = rows
    .filter((r) => r.deleted_at)
    .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  const key = savedDayNameKey(search);
  const visible = key
    ? liveRows.filter((r) => savedDayNameKey(`${r.title} ${r.source_label ?? ""}`).includes(key))
    : liveRows;

  async function restore(row: TemplateSummary) {
    setBusy(row.id);
    try {
      const res = await restoreSavedDay({ id: row.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMoved((m) => ({ ...m, [row.id]: null }));
      setTitles((m) => ({ ...m, [row.id]: res.title }));
      toast(t("sd.restoredToast", { name: res.title }));
      router.refresh();
    } catch {
      toast.error(t("sd.restoreError"));
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: TemplateSummary) {
    setBusy(row.id);
    try {
      const res = await deleteSavedDay({ id: row.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMoved((m) => ({ ...m, [row.id]: new Date().toISOString() }));
      toast(t("sd.deletedToast", { name: row.title }), {
        action: { label: t("sd.undo"), onClick: () => void restore(row) },
      });
      router.refresh();
    } catch {
      toast.error(t("sd.deleteError"));
    } finally {
      setBusy(null);
    }
  }

  function renamed(id: string, title: string) {
    setTitles((m) => ({ ...m, [id]: title }));
    toast(t("sd.renamed", { name: title }));
    router.refresh();
  }

  function sourceText(row: TemplateSummary) {
    return row.source_label ? t("sd.fromSource", { source: row.source_label }) : t("sd.createdHere");
  }

  function renameButtonId(id: string, variant: "table" | "card") {
    return `sd-rename-${variant}-${id}`;
  }

  function stopRenaming() {
    const current = renaming;
    setRenaming(null);
    // Give focus back to the Rename button that opened the field.
    if (current) {
      requestAnimationFrame(() => document.getElementById(renameButtonId(current.id, current.variant))?.focus());
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold text-foreground">{t("sd.heading")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("sd.intro")}</p>
        </div>
        <Link
          href="/admin/programs/saved-days/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("sd.new")}
        </Link>
      </header>

      <label
        htmlFor={searchId}
        className="mt-7 flex max-w-lg items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/40"
      >
        <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <span className="sr-only">{t("sd.search")}</span>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("sd.search")}
          className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
        />
      </label>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {key && liveRows.length > 0 ? t("sd.noMatches") : t("sd.empty")}
          </p>
        </div>
      ) : (
        <>
          {/* ≥ md: table */}
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-surface shadow-soft md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">{t("sd.colName")}</th>
                  <th scope="col" className="w-[22%] px-4 py-3">{t("sd.colSource")}</th>
                  <th scope="col" className="w-24 px-4 py-3">{t("sd.colExercises")}</th>
                  <th scope="col" className="w-32 px-4 py-3">{t("sd.colUpdated")}</th>
                  <th scope="col" className="w-48 px-4 py-3 text-right">
                    <span className="sr-only">{t("sd.colActions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="min-w-0 px-4 py-3">
                      {renaming?.id === row.id && renaming.variant === "table" ? (
                        <RenameField id={row.id} title={row.title} onCancel={stopRenaming}
                          onRenamed={(title) => { renamed(row.id, title); stopRenaming(); }} />
                      ) : (
                        <Link
                          href={editorHref(row.id)}
                          className="font-semibold text-foreground underline-offset-2 hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 [overflow-wrap:anywhere]"
                        >
                          {row.title}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground [overflow-wrap:anywhere]">{sourceText(row)}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{row.count}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <time dateTime={row.updated_at}>{dateLabel(row.updated_at, lang, timeZone)}</time>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link href={editorHref(row.id)} aria-label={t("sd.openLabel", { name: row.title })}
                          title={t("sd.open")} className={iconButton}>
                          <FolderOpen className="h-4 w-4" aria-hidden />
                        </Link>
                        <button type="button" id={renameButtonId(row.id, "table")} disabled={busy !== null}
                          onClick={() => setRenaming({ id: row.id, variant: "table" })}
                          aria-label={t("sd.renameLabel", { name: row.title })} title={t("sd.rename")}
                          className={iconButton}>
                          <PencilLine className="h-4 w-4" aria-hidden />
                        </button>
                        <ProgramExportButton mode="template" id={row.id} compact className={`${iconButton} hover:text-brand`} />
                        <button type="button" disabled={busy !== null} onClick={() => remove(row)}
                          aria-label={t("sd.deleteLabel", { name: row.title })} title={t("sd.delete")}
                          className={`${iconButton} hover:bg-danger-tint hover:text-danger`}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* < md: stacked cards */}
          <ul className="mt-6 space-y-3 md:hidden">
            {visible.map((row) => (
              <li key={row.id} className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-soft">
                {renaming?.id === row.id && renaming.variant === "card" ? (
                  <RenameField id={row.id} title={row.title} onCancel={stopRenaming}
                    onRenamed={(title) => { renamed(row.id, title); stopRenaming(); }} />
                ) : (
                  <Link
                    href={editorHref(row.id)}
                    className="block font-display text-lg font-bold text-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 [overflow-wrap:anywhere]"
                  >
                    {row.title}
                  </Link>
                )}
                <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{sourceText(row)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {exercisesCount(lang, row.count)}
                  {" · "}
                  <time dateTime={row.updated_at}>
                    {t("sd.updatedOn", { date: dateLabel(row.updated_at, lang, timeZone) })}
                  </time>
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={editorHref(row.id)} aria-label={t("sd.openLabel", { name: row.title })} className={cardButton}>
                    <FolderOpen className="h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("sd.open")}
                  </Link>
                  <button type="button" id={renameButtonId(row.id, "card")} disabled={busy !== null}
                    onClick={() => setRenaming({ id: row.id, variant: "card" })}
                    aria-label={t("sd.renameLabel", { name: row.title })} className={cardButton}>
                    <PencilLine className="h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("sd.rename")}
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => remove(row)}
                    aria-label={t("sd.deleteLabel", { name: row.title })} className={`${cardButton} text-danger`}>
                    <Trash2 className="h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("sd.delete")}
                  </button>
                  <ProgramExportButton mode="template" id={row.id} compact align="left"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-pill hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {deletedRows.length > 0 && (
        <section className="mt-10" aria-labelledby={`${deletedPanelId}-heading`}>
          <h2 id={`${deletedPanelId}-heading`} className="font-display text-lg font-bold text-foreground">
            <button
              type="button"
              onClick={() => setShowDeleted((v) => !v)}
              aria-expanded={showDeleted}
              aria-controls={deletedPanelId}
              className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-left transition hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <ChevronDown className={`h-4 w-4 flex-none transition ${showDeleted ? "rotate-180" : ""}`} aria-hidden />
              {t("sd.recentlyDeleted")}
              <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {deletedRows.length}
              </span>
            </button>
          </h2>
          <div id={deletedPanelId} hidden={!showDeleted}>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("sd.recentlyDeletedHint", { days: SAVED_DAY_RETENTION_DAYS })}
            </p>
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
              {deletedRows.map((row) => (
                <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold text-foreground [overflow-wrap:anywhere]">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("sd.deletedMeta", {
                        deleted: dateLabel(row.deleted_at as string, lang, timeZone),
                        purge: dateLabel(savedDayPurgeDate(row.deleted_at as string).toISOString(), lang, timeZone),
                      })}
                    </p>
                  </div>
                  <button type="button" disabled={busy !== null} onClick={() => restore(row)}
                    aria-label={t("sd.restoreLabel", { name: row.title })} className={cardButton}>
                    <RotateCcw className="h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("sd.restore")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

/** Inline rename: Enter saves, Escape cancels. */
function RenameField({
  id,
  title,
  onCancel,
  onRenamed,
}: {
  id: string;
  title: string;
  onCancel: () => void;
  onRenamed: (title: string) => void;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next || busy) return;
    if (next === title) {
      onCancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await renameSavedDay({ id, title: next });
      if (res.ok) onRenamed(res.title);
      else setError(res.error);
    } catch {
      setError(t("sd.renameError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="min-w-0">
      <label htmlFor={inputId} className="sr-only">{t("sd.newNameLabel", { name: title })}</label>
      <input
        id={inputId}
        autoFocus
        type="text"
        value={value}
        maxLength={SAVED_DAY_TITLE_MAX}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
        aria-invalid={!!error || value.trim() === "" || undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
      />
      {error && <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || value.trim() === ""}
          className="min-h-11 rounded-xl bg-brand-solid px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
        >
          {busy ? t("common.saving") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
