"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Settings2,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { formatDayWithWeekday, type Lang } from "@/lib/i18n";
import { addLocalDays, formatZonedDateTime } from "@/lib/scheduling";
import type {
  AppointmentWithClient,
  BookableAvailabilitySlot,
  ClientProposalWithClient,
  CoachSettings,
  SchedulingMode,
} from "@/lib/types";
import {
  acceptProposal,
  cancelAppointment,
  confirmAppointment,
  createDirectAppointment,
  declineProposal,
  publishAvailability,
  setAvailabilitySlotState,
  updateAppointmentDetails,
  updateSchedulingSettings,
} from "./actions";

export type SchedulingClientOption = {
  id: string;
  full_name: string | null;
  timezone: string | null;
};

type Pattern = {
  id: number;
  localTime: string;
  durationMin: string;
  note: string;
};

const card =
  "min-w-0 rounded-2xl border border-border bg-surface/70 p-4 shadow-soft sm:p-6";
const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition placeholder:text-subtle-foreground focus:border-brand/45 focus:ring-2 focus:ring-brand/15";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-55";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-brand/30 hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-55";
const danger =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-danger/25 bg-danger-tint px-3.5 py-2 text-sm font-semibold text-danger transition hover:border-danger/45 disabled:cursor-not-allowed disabled:opacity-55";

export default function SchedulingManager({
  lang,
  weekStart,
  settings,
  appointments,
  slots,
  pendingAppointments,
  pendingProposals,
  clients,
}: {
  lang: Lang;
  weekStart: string;
  settings: CoachSettings;
  appointments: AppointmentWithClient[];
  slots: BookableAvailabilitySlot[];
  pendingAppointments: AppointmentWithClient[];
  pendingProposals: ClientProposalWithClient[];
  clients: SchedulingClientOption[];
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index)),
    [weekStart],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<SchedulingMode>(settings.scheduling_mode);
  const [defaultDuration, setDefaultDuration] = useState(
    String(settings.default_duration_min),
  );
  const [timezone, setTimezone] = useState(settings.timezone);

  const [firstDate, setFirstDate] = useState(weekStart);
  const [weeks, setWeeks] = useState("1");
  const [patterns, setPatterns] = useState<Pattern[]>([
    {
      id: 1,
      localTime: "10:00",
      durationMin: String(settings.default_duration_min),
      note: "",
    },
  ]);
  const [nextPatternId, setNextPatternId] = useState(2);

  const [directClient, setDirectClient] = useState(clients[0]?.id ?? "");
  const [directDate, setDirectDate] = useState(weekStart);
  const [directTime, setDirectTime] = useState("10:00");
  const [directDuration, setDirectDuration] = useState(
    String(settings.default_duration_min),
  );
  const [directAgenda, setDirectAgenda] = useState("");
  const [directCoachNote, setDirectCoachNote] = useState("");
  const [directMeetingUrl, setDirectMeetingUrl] = useState("");

  async function run(
    key: string,
    operation: () => Promise<{ ok: boolean; error?: string; count?: number }>,
    successKey: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      const result = await operation();
      if (!result.ok) {
        setError(result.error ?? t("schedule.err.saveFailed"));
        return false;
      }
      toast(
        result.count == null
          ? t(successKey)
          : t(successKey, { n: result.count }),
      );
      router.refresh();
      return true;
    } catch {
      setError(t("schedule.err.saveFailed"));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    await run(
      "settings",
      () =>
        updateSchedulingSettings({
          mode,
          durationMin: Number(defaultDuration),
          timezone,
        }),
      "schedule.toast.settingsSaved",
    );
  }

  async function publish() {
    const ok = await run(
      "publish",
      () =>
        publishAvailability({
          firstDate,
          timezone: settings.timezone,
          weeks: Number(weeks),
          patterns: patterns.map((pattern) => ({
            localTime: pattern.localTime,
            durationMin: Number(pattern.durationMin),
            note: pattern.note,
          })),
        }),
      "schedule.toast.slotsPublished",
    );
    if (ok) {
      setPatterns((current) => current.map((item) => ({ ...item, note: "" })));
    }
  }

  async function createDirect() {
    const ok = await run(
      "direct",
      () =>
        createDirectAppointment({
          clientId: directClient,
          localDate: directDate,
          localTime: directTime,
          timezone: settings.timezone,
          durationMin: Number(directDuration),
          agenda: directAgenda,
          coachNote: directCoachNote,
          meetingUrl: directMeetingUrl,
        }),
      "schedule.toast.appointmentCreated",
    );
    if (ok) {
      setDirectAgenda("");
      setDirectCoachNote("");
      setDirectMeetingUrl("");
    }
  }

  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, BookableAvailabilitySlot[]>();
    for (const day of days) grouped.set(day, []);
    for (const slot of slots) {
      const day = formatZonedDateTime(
        slot.starts_at,
        settings.timezone,
        locale,
      ).date;
      grouped.get(day)?.push(slot);
    }
    return grouped;
  }, [days, locale, settings.timezone, slots]);

  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentWithClient[]>();
    for (const day of days) grouped.set(day, []);
    for (const appointment of appointments) {
      const day = formatZonedDateTime(
        appointment.starts_at,
        settings.timezone,
        locale,
      ).date;
      grouped.get(day)?.push(appointment);
    }
    return grouped;
  }, [appointments, days, locale, settings.timezone]);

  const previousWeek = addLocalDays(weekStart, -7);
  const nextWeek = addLocalDays(weekStart, 7);
  const pendingCount = pendingAppointments.length + pendingProposals.length;

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {t("schedule.adminEyebrow")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("schedule.adminTitle")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("schedule.adminBody", { timezone: settings.timezone })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/availability?week=${previousWeek}`}
            className={secondary}
            aria-label={t("schedule.previousWeek")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground">
            {formatDayWithWeekday(weekStart, lang)} – {formatDayWithWeekday(addLocalDays(weekStart, 6), lang)}
          </span>
          <Link
            href={`/admin/availability?week=${nextWeek}`}
            className={secondary}
            aria-label={t("schedule.nextWeek")}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className={card}>
        <SectionHeading
          icon={Settings2}
          title={t("schedule.settingsTitle")}
          body={t("schedule.settingsBody")}
        />
        <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-3">
          <Field label={t("schedule.mode") }>
            <select value={mode} onChange={(event) => setMode(event.target.value as SchedulingMode)} className={input}>
              <option value="coach_slots">{t("schedule.mode.coachSlots")}</option>
              <option value="client_proposal">{t("schedule.mode.clientProposal")}</option>
            </select>
          </Field>
          <Field label={t("schedule.defaultDuration") }>
            <input type="number" min={5} max={480} step={5} value={defaultDuration} onChange={(event) => setDefaultDuration(event.target.value)} className={input} />
          </Field>
          <Field label={t("schedule.coachTimezone") }>
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className={input} list="schedule-timezones" autoComplete="off" />
          </Field>
        </div>
        <datalist id="schedule-timezones">
          <option value="Europe/Istanbul" />
          <option value="America/Toronto" />
          <option value="Europe/London" />
          <option value="Europe/Berlin" />
          <option value="America/New_York" />
          <option value="UTC" />
        </datalist>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={saveSettings} disabled={busy !== null} className={primary}>
            <Check className="h-4 w-4" aria-hidden />
            {busy === "settings" ? t("common.saving") : t("schedule.saveSettings")}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            icon={CalendarClock}
            title={t("schedule.weekTitle")}
            body={t("schedule.weekBody", { timezone: settings.timezone })}
          />
          <StatusPill status={settings.scheduling_mode} label={t(`schedule.mode.${settings.scheduling_mode === "coach_slots" ? "coachSlots" : "clientProposal"}`)} />
        </div>
        <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((day) => {
            const daySlots = slotsByDay.get(day) ?? [];
            const dayAppointments = appointmentsByDay.get(day) ?? [];
            return (
              <div key={day} className="min-w-0 rounded-xl border border-border bg-background/65 p-3">
                <h3 className="text-sm font-bold text-foreground">{formatDayWithWeekday(day, lang)}</h3>
                <div className="mt-3 space-y-2">
                  {dayAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      coachTimezone={settings.timezone}
                      locale={locale}
                      busy={busy}
                      run={run}
                    />
                  ))}
                  {daySlots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      timezone={settings.timezone}
                      locale={locale}
                      busy={busy}
                      run={run}
                    />
                  ))}
                  {dayAppointments.length === 0 && daySlots.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-2 py-4 text-center text-xs text-subtle-foreground">
                      {t("schedule.dayEmpty")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid min-w-0 gap-8 xl:grid-cols-2">
        <section className={card}>
          <SectionHeading
            icon={Plus}
            title={t("schedule.publishTitle")}
            body={t("schedule.publishBody", { timezone: settings.timezone })}
          />
          {settings.scheduling_mode !== "coach_slots" && (
            <p className="mt-4 rounded-xl bg-pill px-3.5 py-3 text-sm text-muted-foreground">
              {t("schedule.publishInactiveMode")}
            </p>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={t("schedule.firstDate") }>
              <input type="date" value={firstDate} onChange={(event) => setFirstDate(event.target.value)} className={input} />
            </Field>
            <Field label={t("schedule.repeatWeeks") }>
              <input type="number" min={1} max={52} value={weeks} onChange={(event) => setWeeks(event.target.value)} className={input} />
            </Field>
          </div>
          <div className="mt-5 space-y-3">
            {patterns.map((pattern, index) => (
              <div key={pattern.id} className="min-w-0 rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">{t("schedule.slotNumber", { n: index + 1 })}</p>
                  {patterns.length > 1 && (
                    <button type="button" onClick={() => setPatterns((current) => current.filter((item) => item.id !== pattern.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-danger-tint hover:text-danger" aria-label={t("schedule.removeSlot") }>
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                  <Field label={t("schedule.time") }>
                    <input type="time" value={pattern.localTime} onChange={(event) => updatePattern(pattern.id, "localTime", event.target.value)} className={input} />
                  </Field>
                  <Field label={t("schedule.durationLabel") }>
                    <input type="number" min={5} max={480} step={5} value={pattern.durationMin} onChange={(event) => updatePattern(pattern.id, "durationMin", event.target.value)} className={input} />
                  </Field>
                </div>
                <Field label={t("schedule.slotNote") } className="mt-3">
                  <input value={pattern.note} onChange={(event) => updatePattern(pattern.id, "note", event.target.value)} placeholder={t("schedule.slotNotePlaceholder") } className={input} />
                </Field>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setPatterns((current) => [...current, { id: nextPatternId, localTime: "10:00", durationMin: defaultDuration, note: "" }]);
                setNextPatternId((current) => current + 1);
              }}
              className={secondary}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("schedule.addAnotherTime")}
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={
                busy !== null || settings.scheduling_mode !== "coach_slots"
              }
              className={primary}
            >
              {busy === "publish" ? t("schedule.publishing") : t("schedule.publish")}
            </button>
          </div>
        </section>

        <section className={card}>
          <SectionHeading
            icon={UserRoundPlus}
            title={t("schedule.directTitle")}
            body={t("schedule.directBody", { timezone: settings.timezone })}
          />
          {clients.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-subtle-foreground">
              {t("schedule.noClients")}
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <Field label={t("schedule.client") }>
                <select value={directClient} onChange={(event) => setDirectClient(event.target.value)} className={input}>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.full_name?.trim() || t("schedule.unnamedClient")}</option>
                  ))}
                </select>
              </Field>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <Field label={t("schedule.date") }>
                  <input type="date" value={directDate} onChange={(event) => setDirectDate(event.target.value)} className={input} />
                </Field>
                <Field label={t("schedule.time") }>
                  <input type="time" value={directTime} onChange={(event) => setDirectTime(event.target.value)} className={input} />
                </Field>
                <Field label={t("schedule.durationLabel") }>
                  <input type="number" min={5} max={480} step={5} value={directDuration} onChange={(event) => setDirectDuration(event.target.value)} className={input} />
                </Field>
              </div>
              <Field label={t("schedule.agenda") }>
                <textarea rows={2} value={directAgenda} onChange={(event) => setDirectAgenda(event.target.value)} className={`${input} resize-y`} />
              </Field>
              <Field label={t("schedule.meetingUrl") }>
                <input type="url" inputMode="url" value={directMeetingUrl} onChange={(event) => setDirectMeetingUrl(event.target.value)} placeholder="https://meet.google.com/…" className={input} />
              </Field>
              <Field label={t("schedule.coachNote") }>
                <textarea rows={2} value={directCoachNote} onChange={(event) => setDirectCoachNote(event.target.value)} className={`${input} resize-y`} />
              </Field>
              <button type="button" onClick={createDirect} disabled={busy !== null} className={`${primary} w-full sm:w-auto`}>
                {busy === "direct" ? t("common.saving") : t("schedule.createAppointment")}
              </button>
            </div>
          )}
        </section>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            icon={Clock3}
            title={t("schedule.pendingTitle")}
            body={t("schedule.pendingBody")}
          />
          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-brand-solid px-2.5 py-1 text-xs font-bold tabular-nums text-white">
            {pendingCount}
          </span>
        </div>
        {pendingCount === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-9 text-center text-sm text-subtle-foreground">
            {t("schedule.pendingEmpty")}
          </p>
        ) : (
          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-bold text-foreground">{t("schedule.pendingBookings", { n: pendingAppointments.length })}</h3>
              {pendingAppointments.map((appointment) => (
                <PendingBooking key={appointment.id} appointment={appointment} coachTimezone={settings.timezone} locale={locale} busy={busy} run={run} />
              ))}
              {pendingAppointments.length === 0 && <QueueEmpty text={t("schedule.noPendingBookings") } />}
            </div>
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-bold text-foreground">{t("schedule.pendingProposals", { n: pendingProposals.length })}</h3>
              {pendingProposals.map((proposal) => (
                <PendingProposal key={proposal.id} proposal={proposal} coachTimezone={settings.timezone} defaultDuration={settings.default_duration_min} locale={locale} busy={busy} run={run} />
              ))}
              {pendingProposals.length === 0 && <QueueEmpty text={t("schedule.noPendingProposals") } />}
            </div>
          </div>
        )}
      </section>
    </div>
  );

  function updatePattern(id: number, field: keyof Omit<Pattern, "id">, value: string) {
    setPatterns((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }
}

function SectionHeading({ icon: Icon, title, body }: { icon: typeof CalendarClock; title: string; body: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-tint text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>{children}</label>;
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone = status === "confirmed" || status === "open" || status === "coach_slots"
    ? "bg-brand-tint text-[var(--success)]"
    : status === "cancelled" || status === "closed"
      ? "bg-danger-tint text-danger"
      : "bg-[var(--warning-tint)] text-[var(--warning)]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}

function SlotCard({ slot, timezone, locale, busy, run }: {
  slot: BookableAvailabilitySlot;
  timezone: string;
  locale: string;
  busy: string | null;
  run: (key: string, operation: () => Promise<{ ok: boolean; error?: string }>, successKey: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const stamp = formatZonedDateTime(slot.starts_at, timezone, locale);
  const nextStatus = slot.status === "open" ? "closed" : "open";
  return (
    <div className="min-w-0 rounded-lg border border-brand/15 bg-brand-tint/45 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{stamp.timeLabel} {stamp.zoneLabel}</p>
          <p className="text-[11px] text-muted-foreground">{t("schedule.durationMinutes", { n: slot.duration_min })}</p>
        </div>
        <StatusPill status={slot.status} label={t(`schedule.slotStatus.${slot.status}`)} />
      </div>
      {slot.note && <p className="mt-2 break-words text-xs text-muted-foreground">{slot.note}</p>}
      {slot.status !== "booked" && (
        <button type="button" disabled={busy !== null} onClick={() => run(`slot:${slot.id}`, () => setAvailabilitySlotState({ slotId: slot.id, status: nextStatus }), nextStatus === "closed" ? "schedule.toast.slotClosed" : "schedule.toast.slotOpened")} className="mt-2 text-xs font-semibold text-brand hover:underline">
          {busy === `slot:${slot.id}` ? t("common.saving") : nextStatus === "closed" ? t("schedule.closeSlot") : t("schedule.reopenSlot")}
        </button>
      )}
    </div>
  );
}

function AppointmentCard({ appointment, coachTimezone, locale, busy, run }: {
  appointment: AppointmentWithClient;
  coachTimezone: string;
  locale: string;
  busy: string | null;
  run: (key: string, operation: () => Promise<{ ok: boolean; error?: string }>, successKey: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const stamp = formatZonedDateTime(appointment.starts_at, coachTimezone, locale);
  const clientZone = appointment.client?.timezone;
  const clientStamp = clientZone && clientZone !== coachTimezone
    ? formatZonedDateTime(appointment.starts_at, clientZone, locale)
    : null;
  const [agenda, setAgenda] = useState(appointment.agenda ?? "");
  const [coachNote, setCoachNote] = useState(appointment.coach_note ?? "");
  const [meetingUrl, setMeetingUrl] = useState(appointment.meeting_url ?? "");
  const [reason, setReason] = useState("");
  return (
    <details className={`min-w-0 rounded-lg border p-2.5 ${appointment.status === "cancelled" ? "border-border bg-pill/40 opacity-70" : "border-brand/20 bg-surface"}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{appointment.client?.full_name?.trim() || t("schedule.unnamedClient")}</p>
            <p className="text-xs text-muted-foreground">{stamp.timeLabel} {stamp.zoneLabel} · {t("schedule.durationMinutes", { n: appointment.duration_min })}</p>
            {clientStamp && <p className="mt-0.5 text-[11px] text-brand">{t("schedule.clientLocalTime", { time: clientStamp.label })}</p>}
          </div>
          <StatusPill status={appointment.status} label={t(`schedule.status.${appointment.status}`)} />
        </div>
      </summary>
      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <Field label={t("schedule.agenda") }><textarea rows={2} value={agenda} onChange={(event) => setAgenda(event.target.value)} className={`${input} resize-y`} /></Field>
        <Field label={t("schedule.meetingUrl") }><input type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} className={input} /></Field>
        <Field label={t("schedule.coachNote") }><textarea rows={2} value={coachNote} onChange={(event) => setCoachNote(event.target.value)} className={`${input} resize-y`} /></Field>
        {appointment.status !== "cancelled" && (
          <Field label={t("schedule.cancelReason") }><input value={reason} onChange={(event) => setReason(event.target.value)} className={input} /></Field>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" disabled={busy !== null} onClick={() => run(`details:${appointment.id}`, () => updateAppointmentDetails({ appointmentId: appointment.id, agenda, coachNote, meetingUrl }), "schedule.toast.detailsSaved")} className={secondary}>
            {busy === `details:${appointment.id}` ? t("common.saving") : t("schedule.saveDetails")}
          </button>
          {appointment.status !== "cancelled" && (
            <button type="button" disabled={busy !== null} onClick={() => run(`cancel:${appointment.id}`, () => cancelAppointment({ appointmentId: appointment.id, reason }), "schedule.toast.cancelled")} className={danger}>{t("schedule.cancelAppointment")}</button>
          )}
        </div>
      </div>
    </details>
  );
}

function PendingBooking({ appointment, coachTimezone, locale, busy, run }: {
  appointment: AppointmentWithClient;
  coachTimezone: string;
  locale: string;
  busy: string | null;
  run: (key: string, operation: () => Promise<{ ok: boolean; error?: string }>, successKey: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const coachStamp = formatZonedDateTime(appointment.starts_at, coachTimezone, locale);
  const clientStamp = appointment.client?.timezone && appointment.client.timezone !== coachTimezone
    ? formatZonedDateTime(appointment.starts_at, appointment.client.timezone, locale)
    : null;
  return (
    <article className="min-w-0 rounded-xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-foreground">{appointment.client?.full_name?.trim() || t("schedule.unnamedClient")}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{coachStamp.label}</p>
          {clientStamp && <p className="mt-1 text-xs text-brand">{t("schedule.clientLocalTime", { time: clientStamp.label })}</p>}
        </div>
        <StatusPill status="pending" label={t("schedule.status.pending") } />
      </div>
      {appointment.agenda && <p className="mt-3 break-words text-sm text-muted-foreground">{appointment.agenda}</p>}
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("schedule.declineReasonPlaceholder") } className={`${input} mt-3`} />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy !== null} onClick={() => run(`confirm:${appointment.id}`, () => confirmAppointment({ appointmentId: appointment.id }), "schedule.toast.confirmed")} className={`${primary} flex-1`}><Check className="h-4 w-4" aria-hidden />{t("schedule.confirm")}</button>
        <button type="button" disabled={busy !== null} onClick={() => run(`decline-booking:${appointment.id}`, () => cancelAppointment({ appointmentId: appointment.id, reason }), "schedule.toast.declined")} className={`${danger} flex-1`}>{t("schedule.decline")}</button>
      </div>
    </article>
  );
}

function PendingProposal({ proposal, coachTimezone, defaultDuration, locale, busy, run }: {
  proposal: ClientProposalWithClient;
  coachTimezone: string;
  defaultDuration: number;
  locale: string;
  busy: string | null;
  run: (key: string, operation: () => Promise<{ ok: boolean; error?: string }>, successKey: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [duration, setDuration] = useState(String(defaultDuration));
  const [agenda, setAgenda] = useState("");
  const [reason, setReason] = useState("");
  const coachStamp = formatZonedDateTime(proposal.proposed_start, coachTimezone, locale);
  const clientStamp = proposal.client?.timezone && proposal.client.timezone !== coachTimezone
    ? formatZonedDateTime(proposal.proposed_start, proposal.client.timezone, locale)
    : null;
  return (
    <article className="min-w-0 rounded-xl border border-border bg-background/60 p-4">
      <div className="min-w-0">
        <h4 className="truncate font-semibold text-foreground">{proposal.client?.full_name?.trim() || t("schedule.unnamedClient")}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{coachStamp.label}</p>
        {clientStamp && <p className="mt-1 text-xs text-brand">{t("schedule.clientLocalTime", { time: clientStamp.label })}</p>}
        {proposal.note && <p className="mt-3 break-words text-sm text-muted-foreground">{proposal.note}</p>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Field label={t("schedule.durationLabel") }><input type="number" min={5} max={480} step={5} value={duration} onChange={(event) => setDuration(event.target.value)} className={input} /></Field>
        <Field label={t("schedule.agenda") }><input value={agenda} onChange={(event) => setAgenda(event.target.value)} className={input} /></Field>
      </div>
      <Field label={t("schedule.declineReason") } className="mt-3"><input value={reason} onChange={(event) => setReason(event.target.value)} className={input} /></Field>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy !== null} onClick={() => run(`accept:${proposal.id}`, () => acceptProposal({ proposalId: proposal.id, durationMin: Number(duration), agenda }), "schedule.toast.proposalAccepted")} className={`${primary} flex-1`}><Check className="h-4 w-4" aria-hidden />{t("schedule.accept")}</button>
        <button type="button" disabled={busy !== null} onClick={() => run(`decline-proposal:${proposal.id}`, () => declineProposal({ proposalId: proposal.id, reason }), "schedule.toast.proposalDeclined")} className={`${danger} flex-1`}>{t("schedule.decline")}</button>
      </div>
    </article>
  );
}

function QueueEmpty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-subtle-foreground">{text}</p>;
}
