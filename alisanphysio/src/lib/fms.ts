import { addLocalDays, isValidTimeZone, resolveZonedDateTime, zonedDateTimeParts } from "@/lib/scheduling";
import type { Lang } from "@/lib/i18n";

export const FMS_STATUSES = ["booked", "cancelled", "completed", "no_show"] as const;
export type FmsStatus = typeof FMS_STATUSES[number];
export interface FmsSettings {
  timezone: string;
  fms_enabled: boolean;
  fms_days: number[];
  fms_window_start: string;
  fms_window_end: string;
  fms_slot_min: number;
  fms_min_notice_hours: number;
  fms_horizon_days: number;
}
export type FmsSettingsInput = Omit<FmsSettings, "timezone">;
export interface FmsBooking {
  id: string; created_at: string; full_name: string; email: string;
  starts_at: string; duration_min: number; visitor_timezone: string;
  preferred_language: Lang; status: FmsStatus; admin_note: string | null;
}
export interface FmsSlot { startsAt: string; durationMin: number }
export interface FmsSubmission {
  full_name: string; email: string; visitor_timezone: string; starts_at: string;
  consent: boolean; website: string; started_at: number;
}
export type FmsConfirmation = Pick<FmsBooking, "id" | "starts_at" | "duration_min" | "visitor_timezone">;

function minutes(value: string) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value)) return NaN;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}
export function validFmsSettings(s: FmsSettingsInput): boolean {
  if (!s || typeof s.fms_enabled !== "boolean" || !Array.isArray(s.fms_days)) return false;
  const span = minutes(s.fms_window_end) - minutes(s.fms_window_start);
  return s.fms_days.length > 0 && s.fms_days.length <= 7
    && s.fms_days.every(d => Number.isInteger(d) && d >= 1 && d <= 7)
    && new Set(s.fms_days).size === s.fms_days.length
    && Number.isInteger(s.fms_slot_min) && s.fms_slot_min >= 5 && s.fms_slot_min <= 180 && s.fms_slot_min % 5 === 0
    && span > 0 && span % s.fms_slot_min === 0
    && Number.isInteger(s.fms_min_notice_hours) && s.fms_min_notice_hours >= 0 && s.fms_min_notice_hours <= 720
    && Number.isInteger(s.fms_horizon_days) && s.fms_horizon_days >= 1 && s.fms_horizon_days <= 90;
}

/** Resolve each day's wall-clock slot independently; never add 24h to UTC. */
export function generateFmsSlots(settings: FmsSettings, booked: Pick<FmsBooking, "starts_at" | "duration_min">[], now = new Date()): FmsSlot[] {
  if (!validFmsSettings(settings) || !isValidTimeZone(settings.timezone) || !settings.fms_enabled) return [];
  const today = zonedDateTimeParts(now, settings.timezone).date;
  const notice = now.getTime() + settings.fms_min_notice_hours * 3_600_000;
  const result: FmsSlot[] = [];
  for (let day = 0; day < settings.fms_horizon_days; day++) {
    const date = addLocalDays(today, day);
    const isoDay = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    if (!settings.fms_days.includes(isoDay)) continue;
    for (let min = minutes(settings.fms_window_start); min + settings.fms_slot_min <= minutes(settings.fms_window_end); min += settings.fms_slot_min) {
      const time = `${Math.floor(min / 60).toString().padStart(2, "0")}:${(min % 60).toString().padStart(2, "0")}`;
      const resolved = resolveZonedDateTime({ date, time }, settings.timezone, "reject");
      if (!resolved.ok) continue; // Skip nonexistent/ambiguous local times, never shift them.
      const start = Date.parse(resolved.startsAt), end = start + settings.fms_slot_min * 60_000;
      if (start < notice) continue;
      // Ensure the whole call fits before the local window end across DST too.
      const localEnd = zonedDateTimeParts(end, settings.timezone);
      if (localEnd.date !== date || minutes(localEnd.time) > minutes(settings.fms_window_end)) continue;
      if (booked.some(b => start < Date.parse(b.starts_at) + b.duration_min * 60_000 && end > Date.parse(b.starts_at))) continue;
      result.push({ startsAt: resolved.startsAt, durationMin: settings.fms_slot_min });
    }
  }
  return result;
}

export function validFmsSubmission(input: FmsSubmission, now = Date.now()): boolean {
  return !!input && typeof input.full_name === "string" && input.full_name.trim().length > 0 && input.full_name.trim().length <= 120
    && typeof input.email === "string" && input.email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())
    && typeof input.visitor_timezone === "string" && isValidTimeZone(input.visitor_timezone)
    && typeof input.starts_at === "string" && input.starts_at.length <= 40 && Number.isFinite(Date.parse(input.starts_at))
    && input.consent === true && typeof input.website === "string" && input.website.trim() === ""
    && Number.isFinite(input.started_at) && input.started_at > 0 && now - input.started_at >= 2500;
}

/** UTC VEVENT: calendar clients convert the instant to their own timezone. */
export function fmsCalendar(booking: FmsConfirmation, lang: Lang, now = new Date()): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = new Date(booking.starts_at), end = new Date(start.getTime() + booking.duration_min * 60_000);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Train with Alisan//FMS//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${booking.id}@trainwithalisan`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${lang === "tr" ? "Alişan ile FMS görüşmesi" : "FMS screening with Alisan"}`,
    `DESCRIPTION:${lang === "tr" ? "Alişan görüşmeden önce Google Meet bağlantısını e-posta ile paylaşacak." : "Alisan will email a Google Meet link before the call."}`,
    "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR"];
  // RFC 5545 folding counts UTF-8 bytes, not JavaScript characters.
  return lines.map(line => {
    let output = "", chunk = "";
    for (const char of line) {
      if (new TextEncoder().encode(chunk + char).length > 75) { output += chunk + "\r\n"; chunk = " "; }
      chunk += char;
    }
    return output + chunk;
  }).join("\r\n") + "\r\n";
}
