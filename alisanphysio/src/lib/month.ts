/** Calendar periods use the viewer's IANA timezone; date keys never use UTC instants. */
export type Bucket = "past" | "current" | "upcoming";
export const DEFAULT_PROGRAM_TIMEZONE = "Europe/Istanbul";

export function programTimeZone(value?: string | null): string {
  try {
    if (value) {
      new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
      return value;
    }
  } catch { /* Use the coach's zone for profiles not yet configured. */ }
  return DEFAULT_PROGRAM_TIMEZONE;
}

export function localToday(now = new Date(), timeZone?: string | null): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: programTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isMonthStart(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)
    && Number(value.slice(0, 4)) >= 1000;
}

export function thisMonthISO(now = new Date(), timeZone?: string | null): string {
  return `${localToday(now, timeZone).slice(0, 7)}-01`;
}

export function addMonths(iso: string, count: number): string {
  if (!isMonthStart(iso) || !Number.isInteger(count)) throw new RangeError("Invalid month");
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + count, 1)).toISOString().slice(0, 10);
}

export function nextMonthISO(iso: string): string { return addMonths(iso, 1); }

export function daysInMonth(iso: string): number {
  return new Date(Date.parse(nextMonthISO(iso)) - 86_400_000).getUTCDate();
}

export function bucketForMonthStart(iso: string, now = new Date(), timeZone?: string | null): Bucket {
  if (!isMonthStart(iso)) throw new RangeError("Invalid month");
  const current = thisMonthISO(now, timeZone);
  return iso < current ? "past" : iso > current ? "upcoming" : "current";
}

/** Exactly the last seven calendar dates, inclusive through local month-end. */
export function isReviewDue(iso: string, now = new Date(), timeZone?: string | null): boolean {
  return isMonthStart(iso) && thisMonthISO(now, timeZone) === iso
    && Number(localToday(now, timeZone).slice(8)) >= daysInMonth(iso) - 6;
}

export function listMonthStarts(back = 3, ahead = 8, now = new Date(), timeZone?: string | null): string[] {
  const current = thisMonthISO(now, timeZone);
  return Array.from({ length: back + ahead + 1 }, (_, i) => addMonths(current, i - back));
}

export function defaultNewMonth(usedMonths: string[], now = new Date(), timeZone?: string | null): string {
  const used = new Set(usedMonths);
  let month = thisMonthISO(now, timeZone);
  while (used.has(month)) month = nextMonthISO(month);
  return month;
}
