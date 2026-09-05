"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { fmsCopy } from "@/lib/fms-copy";
import { formatZonedDateTime } from "@/lib/scheduling";
import { FMS_STATUSES, validFmsSettings, type FmsBooking, type FmsSettings, type FmsSettingsInput, type FmsStatus } from "@/lib/fms";
import { updateFmsBooking, updateFmsSettings } from "./actions";
const input = "w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";
const button = "min-h-11 rounded-xl bg-brand-solid px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const statusLabel = (c: ReturnType<typeof fmsCopy>, s: FmsStatus) => s === "booked" ? c.bookedStatus : c[s];

export default function FmsManager({ lang, bookings, settings, status }: { lang: Lang; bookings: FmsBooking[]; settings: FmsSettings; status: FmsStatus | "all" }) {
  const c = fmsCopy(lang), router = useRouter();
  return <div className="min-w-0 space-y-8">
    <h1 className="font-display text-3xl font-bold text-foreground">{c.adminTitle}</h1>
    <Settings key={JSON.stringify(settings)} settings={settings} lang={lang} />
    <label className="block max-w-sm space-y-2"><span className="text-sm font-medium">{c.status}</span><select value={status} onChange={e => router.push(`/admin/fms?status=${e.target.value}`)} className={input}>
      <option value="all">{c.all}</option>{FMS_STATUSES.map(s => <option key={s} value={s}>{statusLabel(c, s)}</option>)}
    </select></label>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">{bookings.length ? bookings.map(b => <Booking key={`${b.id}:${b.status}:${b.admin_note}`} booking={b} lang={lang} />) : <p>{c.noBookings}</p>}</div>
  </div>;
}
function Booking({ booking: b, lang }: { booking: FmsBooking; lang: Lang }) {
  const c = fmsCopy(lang), router = useRouter();
  const [status, setStatus] = useState(b.status), [note, setNote] = useState(b.admin_note ?? "");
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  async function save() {
    setPending(true); setMessage("");
    try { const r = await updateFmsBooking({ id: b.id, status, admin_note: note }); setMessage(r.ok ? c.saved : r.taken ? c.taken : c.error); if (r.ok) router.refresh(); }
    catch { setMessage(c.error); } finally { setPending(false); }
  }
  async function copy() { try { await navigator.clipboard.writeText(b.email); setMessage(c.copied); } catch { setMessage(c.error); } }
  return <article className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-soft">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-words font-semibold">{b.full_name}</h2><span className="rounded-full bg-pill px-3 py-1 text-xs font-semibold">{statusLabel(c, b.status)}</span></div>
    <p className="break-all text-sm text-muted-foreground">{b.email} · {b.preferred_language.toUpperCase()}</p>
    <div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="break-words font-medium">{b.visitor_timezone}</p><p>{formatZonedDateTime(b.starts_at, b.visitor_timezone, lang).label}</p></div>
      <div><p className="font-medium">{c.istanbul}</p><p>{formatZonedDateTime(b.starts_at, "Europe/Istanbul", lang).label}</p></div></div>
    <p className="text-sm text-muted-foreground">{b.duration_min} {c.duration}</p>
    <label className="block space-y-2 text-sm"><span>{c.status}</span><select value={status} onChange={e => setStatus(e.target.value as FmsStatus)} className={input}>{FMS_STATUSES.map(s => <option key={s} value={s}>{statusLabel(c, s)}</option>)}</select></label>
    <label className="block space-y-2 text-sm"><span>{c.note}</span><textarea rows={3} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} className={input} /></label>
    <div className="flex flex-wrap gap-3"><button disabled={pending} onClick={save} className={button}>{pending ? c.saving : c.save}</button><button onClick={copy} className="min-h-11 px-2 text-sm font-semibold text-brand">{c.copyEmail}</button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </article>;
}
function Settings({ settings, lang }: { settings: FmsSettings; lang: Lang }) {
  const c = fmsCopy(lang), router = useRouter();
  const [value, setValue] = useState<FmsSettingsInput>({ ...settings, fms_window_start: settings.fms_window_start.slice(0, 5), fms_window_end: settings.fms_window_end.slice(0, 5) });
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!validFmsSettings(value)) { setMessage(c.settingsInvalid); return; }
    setPending(true); setMessage("");
    try { const ok = await updateFmsSettings(value); setMessage(ok ? c.saved : c.error); if (ok) router.refresh(); }
    catch { setMessage(c.error); } finally { setPending(false); }
  }
  return <form onSubmit={save} className="min-w-0 space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
    <h2 className="font-display text-xl font-bold">{c.settings}</h2><p className="break-words text-sm text-muted-foreground">{c.settingsHelp} · {settings.timezone}</p>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={value.fms_enabled} onChange={e => setValue(v => ({ ...v, fms_enabled: e.target.checked }))} className="h-4 w-4 accent-brand" />{c.enabled}</label>
    <fieldset><legend className="mb-2 text-sm font-medium">{c.days}</legend><div className="flex flex-wrap gap-3">{c.weekdays.map((day, i) => <label key={day} className="flex items-center gap-2 rounded-lg bg-pill px-3 py-2 text-sm"><input type="checkbox" checked={value.fms_days.includes(i + 1)} onChange={e => setValue(v => ({ ...v, fms_days: e.target.checked ? [...v.fms_days, i + 1].sort() : v.fms_days.filter(n => n !== i + 1) }))} className="accent-brand" />{day}</label>)}</div></fieldset>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {([['fms_window_start', c.start], ['fms_window_end', c.end]] as const).map(([key, label]) => <label key={key} className="block min-w-0 space-y-2 text-sm"><span>{label}</span><input type="time" required value={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} className={input} /></label>)}
      {([['fms_slot_min', c.slot, 5, 180, 5], ['fms_min_notice_hours', c.notice, 0, 720, 1], ['fms_horizon_days', c.horizon, 1, 90, 1]] as const).map(([key, label, min, max, step]) => <label key={key} className="block min-w-0 space-y-2 text-sm"><span>{label}</span><input type="number" required min={min} max={max} step={step} value={Number.isNaN(value[key]) ? "" : value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value === "" ? NaN : Number(e.target.value) }))} className={input} /></label>)}
    </div>
    <button disabled={pending} className={button}>{pending ? c.saving : c.save}</button>{message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
