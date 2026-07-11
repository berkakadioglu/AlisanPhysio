/**
 * Week helpers for bucketing programs into past / current / upcoming.
 *
 * Programs are keyed by `week_start_date` (the Monday of the week). All math is
 * done on calendar day indices in UTC so it never drifts by a day due to the
 * server's local timezone.
 */

export type Bucket = "past" | "current" | "upcoming";

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** Whole-day index (UTC) for a Y/M/D — safe for calendar comparisons. */
function dayIndex(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Day index of the Monday on or before the given Y/M/D. */
function mondayIndex(y: number, m: number, d: number): number {
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const sinceMonday = (weekday + 6) % 7;
  return dayIndex(y, m, d) - sinceMonday;
}

/** Bucket a program's week_start_date relative to the current week. */
export function bucketForWeekStart(
  weekStartIso: string,
  now: Date = new Date(),
): Bucket {
  const programMonday = mondayIndex(...ymd(weekStartIso));
  const todayMonday = mondayIndex(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
  if (programMonday < todayMonday) return "past";
  if (programMonday > todayMonday) return "upcoming";
  return "current";
}

/**
 * Human-readable Monday–Sunday range, e.g. "Jul 6 – 12, 2026" or
 * "Jun 29 – Jul 5, 2026".
 */
export function formatWeekRange(weekStartIso: string): string {
  const [y, m, d] = ymd(weekStartIso);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 6));

  const fmt = (dt: Date, opts: Intl.DateTimeFormatOptions) =>
    dt.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear !== endYear) {
    return `${fmt(start, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { month: "short", day: "numeric" })}, ${startYear}`;
  }
  return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { day: "numeric" })}, ${startYear}`;
}
