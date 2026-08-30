"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { DashboardEmptyState } from "@/components/dashboard-section-intro";
import type { Lang } from "@/lib/i18n";
import {
  appointmentEndsAt,
  canShowMeetingUrl,
  detectBrowserTimeZone,
  formatZonedDateTime,
  isActiveAppointmentStatus,
  isValidTimeZone,
  zonedDateTimeParts,
} from "@/lib/scheduling";
import type {
  AppointmentStatus,
  BookableAvailabilitySlot,
  ClientAppointment,
  ClientProposal,
  SchedulingMode,
} from "@/lib/types";
import {
  bookSlot,
  cancelOwnAppointment,
  submitProposals,
} from "./actions";

const cardClass =
  "min-w-0 rounded-2xl border border-border bg-surface/65 p-5 shadow-soft sm:p-6";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-55";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-brand/35 hover:bg-brand-tint hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-55";
const inputClass =
  "w-full min-w-0 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";
const subscribeBrowserTimeZone = () => () => {};

type ProposalRow = { id: number; date: string; time: string };

export default function ClientScheduleView({
  lang,
  mode,
  profileTimeZone,
  fallbackTimeZone,
  month,
  monthWasRequested = false,
  monthLabel,
  weekdayLabels,
  generatedAt,
  appointments,
  slots,
  proposals,
}: {
  lang: Lang;
  mode: SchedulingMode;
  profileTimeZone: string | null;
  fallbackTimeZone: string;
  month: string;
  monthWasRequested?: boolean;
  monthLabel: string;
  weekdayLabels: string[];
  generatedAt: string;
  appointments: ClientAppointment[];
  slots: BookableAvailabilitySlot[];
  proposals: ClientProposal[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const nextProposalId = useRef(2);
  const browserTimeZone = useSyncExternalStore(
    subscribeBrowserTimeZone,
    detectBrowserTimeZone,
    () => null,
  );
  const viewerTimeZone =
    (profileTimeZone && isValidTimeZone(profileTimeZone)
      ? profileTimeZone
      : browserTimeZone) ||
    (isValidTimeZone(fallbackTimeZone) ? fallbackTimeZone : "UTC");
  const locale = lang === "tr" ? "tr-TR" : "en-GB";
  const generatedAtMs = Date.parse(generatedAt);
  const [liveNowMs, setLiveNowMs] = useState(generatedAtMs);
  const today = zonedDateTimeParts(liveNowMs, viewerTimeZone).date;

  useEffect(() => {
    if (profileTimeZone || !browserTimeZone || monthWasRequested) return;
    const browserMonth = zonedDateTimeParts(
      generatedAt,
      browserTimeZone,
    ).date.slice(0, 7);
    if (browserMonth !== month) {
      router.replace(`/dashboard/availability?month=${browserMonth}`);
    }
  }, [
    browserTimeZone,
    generatedAt,
    month,
    monthWasRequested,
    profileTimeZone,
    router,
  ]);

  useEffect(() => {
    let nextRevealAt = Number.POSITIVE_INFINITY;
    let nextHideAt = Number.POSITIVE_INFINITY;
    for (const appointment of appointments) {
      if (appointment.status !== "confirmed") continue;
      const startsAt = Date.parse(appointment.starts_at);
      const endsAt = Date.parse(appointmentEndsAt(appointment));
      const revealAt = startsAt - 30 * 60_000;
      if (!appointment.meeting_url && revealAt > liveNowMs) {
        nextRevealAt = Math.min(nextRevealAt, revealAt);
      }
      if (appointment.meeting_url && endsAt > liveNowMs) {
        nextHideAt = Math.min(nextHideAt, endsAt);
      }
    }

    const nextBoundary = Math.min(nextRevealAt, nextHideAt);
    const delay = Number.isFinite(nextBoundary)
      ? Math.min(Math.max(nextBoundary - Date.now() + 150, 0), 30_000)
      : 30_000;
    const timer = window.setTimeout(() => {
      const currentTime = Date.now();
      setLiveNowMs(currentTime);
      if (nextRevealAt <= currentTime) router.refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [appointments, liveNowMs, router]);

  const futureAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => {
          if (!isActiveAppointmentStatus(appointment.status)) return false;
          return Date.parse(appointmentEndsAt(appointment)) >= liveNowMs;
        })
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [appointments, liveNowMs],
  );
  const nextAppointment = futureAppointments[0] ?? null;
  const laterAppointments = futureAppointments.slice(1);
  const history = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            !futureAppointments.some((future) => future.id === appointment.id),
        )
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    [appointments, futureAppointments],
  );
  const pendingProposals = proposals
    .filter((proposal) => proposal.status === "pending")
    .sort((a, b) => a.proposed_start.localeCompare(b.proposed_start));

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, BookableAvailabilitySlot[]>();
    for (const slot of slots) {
      if (Date.parse(slot.starts_at) <= liveNowMs) continue;
      const date = zonedDateTimeParts(slot.starts_at, viewerTimeZone).date;
      const current = grouped.get(date) ?? [];
      current.push(slot);
      grouped.set(date, current);
    }
    return grouped;
  }, [liveNowMs, slots, viewerTimeZone]);
  const monthSlotDates = [...slotsByDate.keys()]
    .filter((date) => date.startsWith(month))
    .sort();
  const firstSlotDate = monthSlotDates[0] ?? null;
  const monthSlotCount = monthSlotDates.reduce(
    (count, date) => count + (slotsByDate.get(date)?.length ?? 0),
    0,
  );
  const defaultProposalDate = today.startsWith(month) ? today : `${month}-01`;
  const [selectedDate, setSelectedDate] = useState<string | null>(
    firstSlotDate ??
      (mode === "client_proposal" ? defaultProposalDate : null),
  );
  const selectedDateIsUsable = Boolean(
    selectedDate?.startsWith(month) &&
      (mode === "client_proposal"
        ? selectedDate >= today
        : (slotsByDate.get(selectedDate)?.length ?? 0) > 0),
  );
  const activeDate = selectedDateIsUsable
    ? selectedDate
    : firstSlotDate ??
      (mode === "client_proposal" ? defaultProposalDate : null);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [proposalRows, setProposalRows] = useState<ProposalRow[]>([
    {
      id: 1,
      date: mode === "client_proposal" ? (activeDate ?? "") : "",
      time: "",
    },
  ]);
  const [proposalNote, setProposalNote] = useState("");
  const [proposalPending, setProposalPending] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClientAppointment | null>(
    null,
  );

  function changeMonth(offset: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
    const value = `${next.getUTCFullYear()}-${String(
      next.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    router.push(`/dashboard/availability?month=${value}`);
  }

  async function book(slotId: string) {
    setBookingError(null);
    setBookingId(slotId);
    try {
      const result = await bookSlot({ slotId });
      if (result.ok) {
        toast(t("schedule.slotBookedToast"));
        router.refresh();
      } else {
        setBookingError(result.error);
        if (result.code === "slot_taken" || result.code === "wrong_mode") {
          router.refresh();
        }
      }
    } catch {
      setBookingError(t("err.scheduleSave"));
    } finally {
      setBookingId(null);
    }
  }

  function chooseCalendarDate(date: string) {
    setSelectedDate(date);
    if (mode === "client_proposal") {
      setProposalRows((current) => {
        if (current.length === 0) return [{ id: 1, date, time: "" }];
        return current.map((row, index) =>
          index === 0 ? { ...row, date } : row,
        );
      });
    }
  }

  function updateProposal(id: number, patch: Partial<ProposalRow>) {
    setProposalRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addProposal() {
    if (proposalRows.length >= 8) return;
    setProposalRows((rows) => [
      ...rows,
      { id: nextProposalId.current++, date: activeDate ?? "", time: "" },
    ]);
  }

  function removeProposal(id: number) {
    setProposalRows((rows) => rows.filter((row) => row.id !== id));
  }

  async function submitProposalForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProposalError(null);
    if (!profileTimeZone || !isValidTimeZone(profileTimeZone)) {
      setProposalError(t("err.scheduleTimezoneRequired"));
      return;
    }
    setProposalPending(true);
    try {
      const result = await submitProposals({
        proposals: proposalRows.map(({ date, time }) => ({ date, time })),
        note: proposalNote,
      });
      if (result.ok) {
        toast(t("schedule.proposalsSentToast", { n: result.count }));
        setProposalRows([
          { id: nextProposalId.current++, date: activeDate ?? "", time: "" },
        ]);
        setProposalNote("");
        router.refresh();
      } else {
        setProposalError(result.error);
        if (result.code === "wrong_mode") router.refresh();
      }
    } catch {
      setProposalError(t("err.scheduleSave"));
    } finally {
      setProposalPending(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      {!profileTimeZone && (
        <aside className="flex min-w-0 flex-col gap-3 rounded-2xl border border-warning/30 bg-[var(--warning-tint)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {t("schedule.timezonePromptTitle")}
            </p>
            <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
              {t("schedule.timezonePromptBody", { zone: viewerTimeZone })}
            </p>
          </div>
          <Link href="/dashboard/profile" className={`${secondaryButton} flex-none`}>
            {t("schedule.setTimezone")}
          </Link>
        </aside>
      )}

      {nextAppointment ? (
        <AppointmentCard
          appointment={nextAppointment}
          locale={locale}
          timeZone={viewerTimeZone}
          nowMs={liveNowMs}
          prominent
          onCancel={setCancelTarget}
        />
      ) : (
        <section className={cardClass}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {t("schedule.nextEyebrow")}
              </p>
              <div className="mt-3">
                <DashboardEmptyState
                  compact
                  title={t("schedule.noNextTitle")}
                  body={t("schedule.noNextBody")}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {pendingProposals.length > 0 && (
        <PendingProposals
          proposals={pendingProposals}
          locale={locale}
          timeZone={viewerTimeZone}
        />
      )}

      <section className={cardClass}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-foreground">
              {t("schedule.calendarTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t(
                mode === "coach_slots"
                  ? "schedule.slotModeBody"
                  : "schedule.proposalModeBody",
              )}
            </p>
          </div>
          <p className="flex-none text-xs font-semibold text-brand">
            {t("schedule.viewerZone", { zone: viewerTimeZone })}
          </p>
        </div>

        <MonthCalendar
          month={month}
          monthLabel={monthLabel}
          weekdayLabels={weekdayLabels}
          selectedDate={activeDate}
          today={today}
          mode={mode}
          slotsByDate={slotsByDate}
          pendingProposals={pendingProposals}
          timeZone={viewerTimeZone}
          onSelectDate={chooseCalendarDate}
          onPrevious={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
        />

        {mode === "coach_slots" ? (
          <SlotPicker
            selectedDate={activeDate}
            slots={activeDate ? (slotsByDate.get(activeDate) ?? []) : []}
            locale={locale}
            timeZone={viewerTimeZone}
            bookingId={bookingId}
            error={bookingError}
            hasAnySlots={monthSlotCount > 0}
            onBook={book}
          />
        ) : (
          <ProposalForm
            rows={proposalRows}
            note={proposalNote}
            minimumDate={today}
            pending={proposalPending}
            error={proposalError}
            timezoneReady={Boolean(
              profileTimeZone && isValidTimeZone(profileTimeZone),
            )}
            onUpdate={updateProposal}
            onRemove={removeProposal}
            onAdd={addProposal}
            onNote={setProposalNote}
            onSubmit={submitProposalForm}
          />
        )}
      </section>

      {laterAppointments.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-display text-lg font-bold text-foreground">
            {t("schedule.laterAppointments")}
          </h2>
          <div className="mt-4 space-y-3">
            {laterAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                locale={locale}
                timeZone={viewerTimeZone}
                nowMs={liveNowMs}
                compact
                onCancel={setCancelTarget}
              />
            ))}
          </div>
        </section>
      )}

      <details className={`${cardClass} group`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          <span className="font-display text-lg font-bold text-foreground">
            {t("schedule.historyTitle")}
          </span>
          <span className="rounded-full bg-pill px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {history.length}
          </span>
        </summary>
        <div className="mt-4 border-t border-border/60 pt-4">
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  locale={locale}
                  timeZone={viewerTimeZone}
                  nowMs={liveNowMs}
                  compact
                  muted
                  onCancel={setCancelTarget}
                />
              ))}
            </div>
          ) : (
            <DashboardEmptyState
              compact
              title={t("schedule.noHistoryTitle")}
              body={t("schedule.noHistoryBody")}
            />
          )}
        </div>
      </details>

      {cancelTarget && (
        <CancelDialog
          appointment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onComplete={() => {
            setCancelTarget(null);
            toast(t("schedule.cancelledToast"));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  locale,
  timeZone,
  nowMs,
  prominent = false,
  compact = false,
  muted = false,
  onCancel,
}: {
  appointment: ClientAppointment;
  locale: string;
  timeZone: string;
  nowMs: number;
  prominent?: boolean;
  compact?: boolean;
  muted?: boolean;
  onCancel: (appointment: ClientAppointment) => void;
}) {
  const { t } = useI18n();
  const formatted = formatZonedDateTime(
    appointment.starts_at,
    timeZone,
    locale,
  );
  return (
    <article
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${
        prominent
          ? "border-brand/25 bg-brand-tint shadow-soft"
          : "border-border bg-background/65"
      } ${muted ? "opacity-75" : ""}`}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {prominent && (
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {t("schedule.nextEyebrow")}
              </span>
            )}
            <StatusBadge status={appointment.status} />
          </div>
          <h2
            className={`mt-2 break-words font-display font-bold text-foreground ${
              compact ? "text-base" : "text-xl"
            }`}
          >
            {appointment.agenda?.trim() || t("schedule.appointmentFallbackTitle")}
          </h2>
          <p className="mt-2 break-words text-sm font-semibold text-foreground">
            {formatted.dateLabel} · {formatted.timeLabel} {formatted.zoneLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("schedule.duration", { n: appointment.duration_min })}
          </p>
          {appointment.cancelled_reason && (
            <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">
              {t("schedule.cancelReasonLabel")}: {appointment.cancelled_reason}
            </p>
          )}
        </div>
        {!compact && (
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-solid text-white">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        {canShowMeetingUrl(appointment, nowMs) && appointment.meeting_url && (
          <a
            href={appointment.meeting_url}
            target="_blank"
            rel="noreferrer"
            className={primaryButton}
          >
            {t("schedule.joinMeeting")}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        {appointment.status === "confirmed" &&
          !appointment.meeting_url &&
          !muted && (
          <p className="mr-auto text-xs leading-relaxed text-muted-foreground">
            {t("schedule.meetingWindowHint")}
          </p>
        )}
        {appointment.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => onCancel(appointment)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/35"
          >
            {t("schedule.cancelAction")}
          </button>
        )}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  const style: Record<AppointmentStatus, string> = {
    pending: "bg-[var(--warning-tint)] text-[var(--warning)]",
    confirmed: "bg-brand-solid text-white",
    cancelled: "bg-pill text-muted-foreground",
    completed: "bg-brand-tint text-brand",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${style[status]}`}
    >
      {t(`schedule.status.${status}`)}
    </span>
  );
}

function MonthCalendar({
  month,
  monthLabel,
  weekdayLabels,
  selectedDate,
  today,
  mode,
  slotsByDate,
  pendingProposals,
  timeZone,
  onSelectDate,
  onPrevious,
  onNext,
}: {
  month: string;
  monthLabel: string;
  weekdayLabels: string[];
  selectedDate: string | null;
  today: string;
  mode: SchedulingMode;
  slotsByDate: Map<string, BookableAvailabilitySlot[]>;
  pendingProposals: ClientProposal[];
  timeZone: string;
  onSelectDate: (date: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading =
    (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const pendingDates = new Set(
    pendingProposals.map(
      (proposal) => zonedDateTimeParts(proposal.proposed_start, timeZone).date,
    ),
  );

  return (
    <div className="mt-5 min-w-0 rounded-2xl border border-border bg-background/70 p-2.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevious}
          aria-label={t("schedule.previousMonth")}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-muted-foreground transition hover:bg-pill hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <h3 className="min-w-0 break-words text-center font-display text-lg font-bold text-foreground">
          {monthLabel}
        </h3>
        <button
          type="button"
          onClick={onNext}
          aria-label={t("schedule.nextMonth")}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-muted-foreground transition hover:bg-pill hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-7 gap-1 sm:gap-1.5">
        {weekdayLabels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="min-w-0 truncate py-1 text-center text-[10px] font-bold uppercase tracking-wide text-subtle-foreground sm:text-xs"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: leading }, (_, index) => (
          <span key={`empty-${index}`} aria-hidden />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const count = slotsByDate.get(date)?.length ?? 0;
          const hasProposal = pendingDates.has(date);
          const isPast = date < today;
          const selectable =
            mode === "coach_slots" ? count > 0 : !isPast;
          const selected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              disabled={!selectable}
              aria-pressed={selected}
              aria-label={
                count > 0
                  ? t("schedule.calendarDaySlots", { date, n: count })
                  : date
              }
              onClick={() => onSelectDate(date)}
              className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:min-h-14 sm:text-sm ${
                selected
                  ? "border-brand bg-brand-solid font-bold text-white shadow-sm"
                  : selectable
                    ? "border-brand/25 bg-brand-tint font-semibold text-foreground hover:border-brand/45"
                    : "border-transparent text-subtle-foreground opacity-55"
              }`}
            >
              <span className="tabular-nums">{day}</span>
              <span className="mt-1 flex min-h-1.5 items-center gap-0.5">
                {count > 0 && (
                  <span
                    className={`h-1.5 min-w-1.5 rounded-full ${
                      selected ? "bg-white" : "bg-brand"
                    }`}
                  />
                )}
                {hasProposal && (
                  <span
                    className={`h-1.5 min-w-1.5 rounded-full ${
                      selected ? "bg-white/65" : "bg-[var(--warning)]"
                    }`}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotPicker({
  selectedDate,
  slots,
  locale,
  timeZone,
  bookingId,
  error,
  hasAnySlots,
  onBook,
}: {
  selectedDate: string | null;
  slots: BookableAvailabilitySlot[];
  locale: string;
  timeZone: string;
  bookingId: string | null;
  error: string | null;
  hasAnySlots: boolean;
  onBook: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-5 min-w-0">
      {selectedDate && (
        <h3 className="break-words text-sm font-semibold text-foreground">
          {t("schedule.availableTimes", { date: selectedDate })}
        </h3>
      )}
      {slots.length > 0 ? (
        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const formatted = formatZonedDateTime(
              slot.starts_at,
              timeZone,
              locale,
            );
            return (
              <article
                key={slot.id}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    <Clock3 className="h-4 w-4 flex-none text-brand" aria-hidden />
                    <span className="break-words">
                      {formatted.timeLabel} {formatted.zoneLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("schedule.duration", { n: slot.duration_min })}
                  </p>
                  {slot.note && (
                    <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                      {slot.note}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={bookingId !== null}
                  onClick={() => onBook(slot.id)}
                  className={`${primaryButton} w-full flex-none sm:w-auto`}
                >
                  {bookingId === slot.id
                    ? t("schedule.booking")
                    : t("schedule.bookSlot")}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <DashboardEmptyState
            compact
            title={t(
              hasAnySlots
                ? "schedule.noSlotsTitle"
                : "schedule.noSlotsPublishedTitle",
            )}
            body={t(
              hasAnySlots
                ? "schedule.noSlotsBody"
                : "schedule.noSlotsPublishedBody",
            )}
          />
        </div>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  );
}

function ProposalForm({
  rows,
  note,
  minimumDate,
  pending,
  error,
  timezoneReady,
  onUpdate,
  onRemove,
  onAdd,
  onNote,
  onSubmit,
}: {
  rows: ProposalRow[];
  note: string;
  minimumDate: string;
  pending: boolean;
  error: string | null;
  timezoneReady: boolean;
  onUpdate: (id: number, patch: Partial<ProposalRow>) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
  onNote: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  return (
    <form onSubmit={onSubmit} className="mt-5 min-w-0 space-y-4">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="grid min-w-0 gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_auto] sm:items-end"
          >
            <label className="min-w-0 space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                {t("schedule.proposalDate", { n: index + 1 })}
              </span>
              <input
                type="date"
                required
                min={minimumDate}
                value={row.date}
                onChange={(event) =>
                  onUpdate(row.id, { date: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                {t("schedule.proposalTime")}
              </span>
              <input
                type="time"
                required
                value={row.time}
                onChange={(event) =>
                  onUpdate(row.id, { time: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <button
              type="button"
              disabled={rows.length === 1}
              onClick={() => onRemove(row.id)}
              aria-label={t("schedule.removeProposal")}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-danger-tint hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={rows.length >= 8}
        onClick={onAdd}
        className={secondaryButton}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {t("schedule.addProposal")}
      </button>

      <label className="block min-w-0 space-y-1.5">
        <span className="block text-sm font-medium text-foreground">
          {t("schedule.proposalNote")}
        </span>
        <textarea
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder={t("schedule.proposalNotePlaceholder")}
          className={`${inputClass} resize-y`}
        />
      </label>

      {error && <ErrorMessage message={error} />}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !timezoneReady}
          className={`${primaryButton} w-full sm:w-auto`}
        >
          {pending ? t("schedule.proposalsSending") : t("schedule.sendProposals")}
        </button>
      </div>
    </form>
  );
}

function PendingProposals({
  proposals,
  locale,
  timeZone,
}: {
  proposals: ClientProposal[];
  locale: string;
  timeZone: string;
}) {
  const { t } = useI18n();
  return (
    <section className="min-w-0 rounded-2xl border border-brand/25 bg-brand-tint p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-solid text-white">
          <Clock3 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-foreground">
            {t("schedule.pendingProposalsTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("schedule.pendingProposalsBody")}
          </p>
          <ul className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
            {proposals.map((proposal) => {
              const formatted = formatZonedDateTime(
                proposal.proposed_start,
                timeZone,
                locale,
              );
              return (
                <li
                  key={proposal.id}
                  className="min-w-0 rounded-xl border border-brand/20 bg-background/65 p-3"
                >
                  <p className="break-words text-sm font-semibold text-foreground">
                    {formatted.dateLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatted.timeLabel} {formatted.zoneLabel}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CancelDialog({
  appointment,
  onClose,
  onComplete,
}: {
  appointment: ClientAppointment;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const frame = window.requestAnimationFrame(() => reasonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
    };
  }, []);

  async function cancel() {
    setError(null);
    setPending(true);
    try {
      const result = await cancelOwnAppointment({
        appointmentId: appointment.id,
        reason,
      });
      if (result.ok) onComplete();
      else setError(result.error);
    } catch {
      setError(t("err.scheduleCancel"));
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%_-_1.5rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-lift backdrop:bg-scrim sm:max-h-[90vh]"
      aria-labelledby="cancel-appointment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="cancel-appointment-title"
              className="font-display text-xl font-bold text-foreground"
            >
              {t("schedule.cancelHeading")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("schedule.cancelBody")}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <label className="mt-5 block space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            {t("schedule.cancelReason")}
          </span>
          <textarea
            ref={reasonRef}
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("schedule.cancelReasonPlaceholder")}
            className={`${inputClass} resize-y`}
          />
        </label>
        {error && <ErrorMessage message={error} />}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={secondaryButton}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={cancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-danger-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-solid-hover disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending ? t("schedule.cancelling") : t("schedule.confirmCancel")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-3 break-words rounded-xl bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
    >
      {message}
    </p>
  );
}
