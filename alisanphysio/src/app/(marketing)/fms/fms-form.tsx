"use client";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { fmsCopy } from "@/lib/fms-copy";
import { detectBrowserTimeZone, formatZonedDateTime } from "@/lib/scheduling";
import { fmsCalendar, type FmsSlot, type FmsConfirmation } from "@/lib/fms";
import { bookFms, getFmsSlots } from "./actions";

const input = "w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-3 text-foreground";
const button = "inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-solid px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";
const alternatives = [["Toronto", "America/Toronto"], ["Vancouver", "America/Vancouver"], ["Montreal", "America/Montreal"], ["Istanbul", "Europe/Istanbul"], ["London", "Europe/London"], ["New York", "America/New_York"]];

export default function FmsForm({ lang }: { lang: Lang }) {
  const c = fmsCopy(lang);
  const [step, setStep] = useState(0), [zone, setZone] = useState("Europe/Istanbul");
  const [zones, setZones] = useState<string[]>([]), [slots, setSlots] = useState<FmsSlot[]>([]);
  const [enabled, setEnabled] = useState(true), [selected, setSelected] = useState<FmsSlot | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""), [confirmation, setConfirmation] = useState<FmsConfirmation | null>(null);
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
    // Browser detection deliberately happens after hydration; the server has no visitor zone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZone(detectBrowserTimeZone() || "Europe/Istanbul");
    setZones(Intl.supportedValuesOf("timeZone"));
  }, []);
  async function refresh() {
    setPending(true);
    try {
      const result = await getFmsSlots();
      if (!result.ok) { setError(c.error); setSlots([]); }
      else { setSlots(result.slots); setEnabled(result.enabled); }
    } catch { setError(c.error); setSlots([]); }
    finally { setPending(false); }
  }
  async function chooseStep() { setError(""); setStep(1); await refresh(); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (pending || !selected) return;
    setPending(true); setError("");
    try {
      const result = await bookFms({ full_name: name, email, consent, website, started_at: started.current, visitor_timezone: zone, starts_at: selected.startsAt });
      if (result.ok) setConfirmation(result.booking);
      else {
        setError(result.error);
        if (result.taken) { setSelected(null); setStep(1); await refresh(); }
      }
    } catch { setError(c.error); }
    finally { setPending(false); }
  }
  function download() {
    if (!confirmation) return;
    const url = URL.createObjectURL(new Blob([fmsCalendar(confirmation, lang)], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `fms-${confirmation.id}.ics`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const groups = new Map<string, { label: string; slots: FmsSlot[] }>();
  for (const slot of slots) {
    const local = formatZonedDateTime(slot.startsAt, zone, lang);
    const group = groups.get(local.date) ?? { label: local.dateLabel, slots: [] };
    group.slots.push(slot); groups.set(local.date, group);
  }
  const time = (slot: FmsSlot, timezone: string) => formatZonedDateTime(slot.startsAt, timezone, lang);
  if (confirmation) return <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-8" aria-live="polite">
    <h1 className="font-display text-3xl font-bold text-foreground">{c.booked}</h1>
    <p className="break-words font-semibold text-brand">{formatZonedDateTime(confirmation.starts_at, confirmation.visitor_timezone, lang).label} · {confirmation.visitor_timezone}</p>
    <p className="text-sm text-muted-foreground">{c.istanbul}: {formatZonedDateTime(confirmation.starts_at, "Europe/Istanbul", lang).label}</p>
    <p className="text-sm text-muted-foreground">{confirmation.duration_min} {c.duration}</p>
    <p className="text-foreground">{c.whatNext}</p><button onClick={download} className={button}>{c.calendar}</button>
  </section>;
  return <div className="min-w-0 space-y-7">
    <header><h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">{c.title}</h1><p className="mt-3 text-muted-foreground">{c.intro}</p></header>
    <section className="min-w-0 space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-8" aria-busy={pending}>
      <p className="text-xs font-semibold text-brand">{step + 1} / 3</p>
      <h2 className="font-display text-2xl font-bold text-foreground">{[c.location, c.choose, c.details][step]}</h2>
      {error && <p role="alert" className="rounded-xl bg-danger-tint p-3 text-sm text-danger">{error}</p>}
      {step === 0 && <>
        <p className="text-sm text-muted-foreground">{c.timezoneHelp}</p>
        <label className="block space-y-2 text-sm font-medium"><span>{c.timezone}</span>
          <select value={zone} onChange={e => { setZone(e.target.value); setSelected(null); }} className={input}>
            <optgroup label={c.likely}>{alternatives.map(([label, value]) => <option key={value} value={value}>{label} · {value}</option>)}</optgroup>
            <optgroup label={c.allZones}>{[...new Set([zone, ...zones])].sort().map(z => <option key={z} value={z}>{z}</option>)}</optgroup>
          </select></label>
        <button onClick={chooseStep} disabled={pending} className={button}>{c.next}</button>
      </>}
      {step === 1 && <>
        <p className="break-words text-sm text-muted-foreground">{c.yourTime} {zone}</p>
        {pending ? <p role="status">{c.loading}</p> : !slots.length && <p>{enabled ? c.empty : c.disabled}</p>}
        {!pending && [...groups].map(([date, group]) => <section key={date} className="space-y-3">
          <h3 className="font-semibold text-foreground">{group.label}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{group.slots.map(slot => <button key={slot.startsAt} type="button" onClick={() => { setSelected(slot); setError(""); setStep(2); }} className="min-w-0 space-y-1 rounded-xl border border-border bg-background p-3 text-left transition hover:border-brand">
            <span className="block font-semibold text-brand">{time(slot, zone).timeLabel} · {slot.durationMin} {c.duration}</span>
            <span className="block text-xs text-muted-foreground">{c.istanbul}: {time(slot, "Europe/Istanbul").label}</span>
          </button>)}</div>
        </section>)}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => setStep(0)} className="min-h-11 px-3 text-sm">{c.back}</button><button type="button" disabled={pending} onClick={() => { setError(""); void refresh(); }} className={button}>{c.retry}</button></div>
      </>}
      {step === 2 && selected && <form onSubmit={submit} className="space-y-5">
        <div className="rounded-xl bg-pill p-4 text-sm"><p className="font-semibold">{time(selected, zone).label}</p><p className="break-words">{zone} · {selected.durationMin} {c.duration}</p><p className="mt-1 text-muted-foreground">{c.istanbul}: {time(selected, "Europe/Istanbul").label}</p></div>
        <label className="block space-y-2"><span>{c.name}</span><input required autoComplete="name" maxLength={120} value={name} onChange={e => setName(e.target.value)} className={input} /></label>
        <label className="block space-y-2"><span>{c.email}</span><input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={input} /></label>
        <div className="hidden" aria-hidden="true"><label>{c.website}<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label></div>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-4 w-4 shrink-0 accent-brand" type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>{c.consent}</span></label>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => setStep(1)} className="min-h-11 px-3 text-sm">{c.back}</button><button disabled={pending} className={button}>{pending ? c.confirming : c.confirm}</button></div>
      </form>}
    </section>
  </div>;
}
