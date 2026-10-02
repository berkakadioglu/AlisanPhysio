import type {
  Appointment,
  AppointmentReminderKind,
  AppointmentStatus,
} from "@/lib/types";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const WALL_CLOCK_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

export interface LocalDateTime {
  /** Calendar date in the selected timezone, formatted YYYY-MM-DD. */
  date: string;
  /** Wall-clock time in the selected timezone, formatted HH:mm. */
  time: string;
}

export interface ZonedDateTimeParts extends LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export type ZonedDateTimeFailureReason =
  | "invalid_date"
  | "invalid_time"
  | "invalid_time_zone"
  | "nonexistent_local_time"
  | "ambiguous_local_time";

export type ZonedDateTimeResolution =
  | {
      ok: true;
      /** ISO-8601 UTC instant, ready for a timestamptz column. */
      startsAt: string;
      offsetMinutes: number;
    }
  | {
      ok: false;
      reason: ZonedDateTimeFailureReason;
    };

export type ZonedDateTimeDisambiguation = "earlier" | "later" | "reject";

export interface RecurringOccurrence extends LocalDateTime {
  startsAt: string;
  durationMin: number;
}

export interface FormattedZonedDateTime extends LocalDateTime {
  dateLabel: string;
  timeLabel: string;
  zoneLabel: string;
  label: string;
}

export interface DueAppointmentReminder {
  kind: AppointmentReminderKind;
  dueAt: string;
  dedupeKey: string;
}

export const APPOINTMENT_REMINDER_OFFSETS_MIN: Readonly<
  Record<AppointmentReminderKind, number>
> = {
  "24h": 24 * 60,
  "12h": 12 * 60,
};

/** True only for a timezone name understood by the current Intl runtime. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Browser timezone suggestion. Persisting it remains an explicit profile action. */
export function detectBrowserTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
  } catch {
    return null;
  }
}

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = WALL_CLOCK_FORMATTERS.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  WALL_CLOCK_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function numericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  return Number(value);
}

/** Calendar/wall-clock fields for an instant as seen in `timeZone`. */
export function zonedDateTimeParts(
  instant: string | number | Date,
  timeZone: string,
): ZonedDateTimeParts {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Invalid IANA timezone: ${timeZone}`);
  }
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("Invalid instant");
  }

  const parts = wallClockFormatter(timeZone).formatToParts(date);
  const year = numericPart(parts, "year");
  const month = numericPart(parts, "month");
  const day = numericPart(parts, "day");
  const hour = numericPart(parts, "hour");
  const minute = numericPart(parts, "minute");

  return {
    year,
    month,
    day,
    hour,
    minute,
    date: `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    time: `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`,
  };
}

function parseLocalDate(date: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

function parseLocalTime(time: string): [number, number] | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? [hour, minute]
    : null;
}

function timezoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const instant = new Date(instantMs);
  const parts = wallClockFormatter(timeZone).formatToParts(instant);
  const asUtc = Date.UTC(
    numericPart(parts, "year"),
    numericPart(parts, "month") - 1,
    numericPart(parts, "day"),
    numericPart(parts, "hour"),
    numericPart(parts, "minute"),
    numericPart(parts, "second"),
  );
  // Intl only exposes whole seconds here. Discard milliseconds before comparing.
  const instantSeconds = Math.trunc(instantMs / 1_000) * 1_000;
  return Math.round((asUtc - instantSeconds) / MINUTE_MS);
}

function hasRequestedWallClock(
  instantMs: number,
  timeZone: string,
  requested: ZonedDateTimeParts,
): boolean {
  const actual = zonedDateTimeParts(instantMs, timeZone);
  return (
    actual.year === requested.year &&
    actual.month === requested.month &&
    actual.day === requested.day &&
    actual.hour === requested.hour &&
    actual.minute === requested.minute
  );
}

/**
 * Resolve a local date/time to a real UTC instant without a date library.
 *
 * Offset candidates are sampled around the requested calendar day and then
 * verified by formatting each candidate back through Intl. That verification
 * is what makes DST gaps/folds safe: nonexistent times return a clear failure,
 * while an ambiguous fall-back time follows the requested disambiguation.
 */
export function resolveZonedDateTime(
  local: LocalDateTime,
  timeZone: string,
  disambiguation: ZonedDateTimeDisambiguation = "earlier",
): ZonedDateTimeResolution {
  const dateParts = parseLocalDate(local.date);
  if (!dateParts) return { ok: false, reason: "invalid_date" };
  const timeParts = parseLocalTime(local.time);
  if (!timeParts) return { ok: false, reason: "invalid_time" };
  if (!isValidTimeZone(timeZone)) {
    return { ok: false, reason: "invalid_time_zone" };
  }

  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  const requested: ZonedDateTimeParts = {
    year,
    month,
    day,
    hour,
    minute,
    date: local.date,
    time: local.time,
  };
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  // A transition can expose two offsets on the same local day. Sampling both
  // sides of it supplies both candidates; formatting back proves validity.
  const sampledOffsets = new Set<number>();
  for (const dayOffset of [-2, -1, 0, 1, 2]) {
    sampledOffsets.add(
      timezoneOffsetMinutes(wallClockAsUtc + dayOffset * DAY_MS, timeZone),
    );
  }

  const matchingInstants = [...sampledOffsets]
    .map((offset) => wallClockAsUtc - offset * MINUTE_MS)
    .filter((instantMs) =>
      hasRequestedWallClock(instantMs, timeZone, requested),
    )
    .sort((a, b) => a - b);

  const uniqueInstants = [...new Set(matchingInstants)];
  if (uniqueInstants.length === 0) {
    return { ok: false, reason: "nonexistent_local_time" };
  }
  if (uniqueInstants.length > 1 && disambiguation === "reject") {
    return { ok: false, reason: "ambiguous_local_time" };
  }

  const instantMs =
    disambiguation === "later"
      ? uniqueInstants[uniqueInstants.length - 1]
      : uniqueInstants[0];
  return {
    ok: true,
    startsAt: new Date(instantMs).toISOString(),
    offsetMinutes: timezoneOffsetMinutes(instantMs, timeZone),
  };
}

/** Add whole calendar days without applying timezone/instant arithmetic. */
export function addLocalDays(date: string, days: number): string {
  const parsed = parseLocalDate(date);
  if (!parsed || !Number.isInteger(days)) {
    throw new RangeError("Invalid local date or day count");
  }
  const [year, month, day] = parsed;
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

/**
 * Build a seven-day pattern by advancing the LOCAL date, then resolving each wall
 * clock occurrence independently. UTC differences may be 167/169 hours at a
 * DST boundary; the intended local hour never drifts.
 */
export function generateRecurringOccurrences(input: {
  firstDate: string;
  localTime: string;
  timeZone: string;
  weeks: number;
  durationMin: number;
  disambiguation?: ZonedDateTimeDisambiguation;
}): RecurringOccurrence[] {
  if (!Number.isInteger(input.weeks) || input.weeks < 1 || input.weeks > 104) {
    throw new RangeError("weeks must be an integer between 1 and 104");
  }
  if (
    !Number.isInteger(input.durationMin) ||
    input.durationMin < 1 ||
    input.durationMin > 24 * 60
  ) {
    throw new RangeError("durationMin must be an integer between 1 and 1440");
  }

  return Array.from({ length: input.weeks }, (_, index) => {
    const date = addLocalDays(input.firstDate, index * 7);
    const resolved = resolveZonedDateTime(
      { date, time: input.localTime },
      input.timeZone,
      input.disambiguation ?? "earlier",
    );
    if (!resolved.ok) {
      throw new RangeError(`${resolved.reason}: ${date} ${input.localTime}`);
    }
    return {
      date,
      time: input.localTime,
      startsAt: resolved.startsAt,
      durationMin: input.durationMin,
    };
  });
}

/** UTC range for querying rows whose starts_at falls in local calendar dates. */
export function localDateRangeToUtc(
  firstDate: string,
  endDateExclusive: string,
  timeZone: string,
): { startsAt: string; endsAt: string } {
  const start = resolveZonedDateTime(
    { date: firstDate, time: "00:00" },
    timeZone,
  );
  const end = resolveZonedDateTime(
    { date: endDateExclusive, time: "00:00" },
    timeZone,
  );
  if (!start.ok || !end.ok || Date.parse(end.startsAt) <= Date.parse(start.startsAt)) {
    throw new RangeError("Invalid local date range");
  }
  return { startsAt: start.startsAt, endsAt: end.startsAt };
}

/** Localised viewer-facing date, time, and explicit short zone label. */
export function formatZonedDateTime(
  instant: string | number | Date,
  timeZone: string,
  locale = "en",
): FormattedZonedDateTime {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Invalid IANA timezone: ${timeZone}`);
  }
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid instant");

  const dateLabel = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const zoneFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: "short",
  });
  const zoneParts = zoneFormatter.formatToParts(date);
  const zoneLabel =
    zoneParts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  const timeLabel = timeFormatter.format(date).replace(/^(\d)(:)/, "0$1$2");
  const parts = zonedDateTimeParts(date, timeZone);

  return {
    date: parts.date,
    time: parts.time,
    dateLabel,
    timeLabel,
    zoneLabel,
    label: `${dateLabel} · ${timeLabel} ${zoneLabel}`,
  };
}

export function appointmentEndsAt(
  appointment: Pick<Appointment, "starts_at" | "duration_min">,
): string {
  const startsAt = Date.parse(appointment.starts_at);
  if (!Number.isFinite(startsAt) || appointment.duration_min < 1) {
    throw new RangeError("Invalid appointment time or duration");
  }
  return new Date(startsAt + appointment.duration_min * MINUTE_MS).toISOString();
}

/** A meeting link is accepted only when it is an absolute HTTPS URL. */
export function isValidMeetingUrl(value: string | null | undefined): boolean {
  if (!value || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Client visibility window: confirmed only, from 30 minutes before start
 * through the exact appointment end. The URL is validated at this boundary too.
 */
export function canShowMeetingUrl(
  appointment: Pick<
    Appointment,
    "starts_at" | "duration_min" | "status" | "meeting_url"
  >,
  now: string | number | Date = Date.now(),
): boolean {
  if (
    appointment.status !== "confirmed" ||
    !isValidMeetingUrl(appointment.meeting_url)
  ) {
    return false;
  }
  const nowMs = new Date(now).getTime();
  const startsAt = Date.parse(appointment.starts_at);
  if (!Number.isFinite(nowMs) || !Number.isFinite(startsAt)) return false;
  const endsAt = startsAt + appointment.duration_min * MINUTE_MS;
  return nowMs >= startsAt - 30 * MINUTE_MS && nowMs <= endsAt;
}

export function appointmentReminderDedupeKey(
  appointmentId: string,
  kind: AppointmentReminderKind,
): string {
  return `appointment_reminder:${appointmentId}:${kind}`;
}

/**
 * Pure lazy-reminder decision. Callers pass kinds already persisted for the
 * recipient; the database unique constraint remains the final idempotency guard.
 */
export function dueAppointmentReminders(
  appointment: Pick<Appointment, "id" | "starts_at" | "status">,
  existingKinds: Iterable<AppointmentReminderKind> = [],
  now: string | number | Date = Date.now(),
): DueAppointmentReminder[] {
  const nowMs = new Date(now).getTime();
  const startsAt = Date.parse(appointment.starts_at);
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(startsAt) ||
    startsAt <= nowMs ||
    !isActiveAppointmentStatus(appointment.status)
  ) {
    return [];
  }

  const existing = new Set(existingKinds);
  return (Object.entries(APPOINTMENT_REMINDER_OFFSETS_MIN) as [
    AppointmentReminderKind,
    number,
  ][])
    .filter(
      ([kind, minutes]) =>
        !existing.has(kind) && nowMs >= startsAt - minutes * MINUTE_MS,
    )
    .map(([kind, minutes]) => ({
      kind,
      dueAt: new Date(startsAt - minutes * MINUTE_MS).toISOString(),
      dedupeKey: appointmentReminderDedupeKey(appointment.id, kind),
    }));
}

/** Statuses that represent a live future appointment in schedule summaries. */
export function isActiveAppointmentStatus(status: AppointmentStatus): boolean {
  return status === "pending" || status === "confirmed";
}

/** Calendar week anchor used only by the scheduling grid. */
export function mondayOfISO(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
