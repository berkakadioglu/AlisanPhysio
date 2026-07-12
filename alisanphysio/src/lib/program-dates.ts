/**
 * Date helpers for the admin program editor. These are for authoring
 * convenience (snapping to Mondays, suggesting next week) and are intentionally
 * separate from the read-only bucketing math in week.ts, which is untouched.
 * All math is on UTC day boundaries so it never drifts by timezone.
 */

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function toISO(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

const DAY = 86_400_000;

/** The Monday on or before the given ISO date (YYYY-MM-DD). */
export function mondayOfISO(iso: string): string {
  const [y, m, d] = ymd(iso);
  const base = Date.UTC(y, m - 1, d);
  const weekday = new Date(base).getUTCDay(); // 0=Sun..6=Sat
  const sinceMonday = (weekday + 6) % 7;
  return toISO(base - sinceMonday * DAY);
}

/** The Monday of the current week (based on the server's "today"). */
export function thisMondayISO(now: Date = new Date()): string {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return mondayOfISO(iso);
}

/** The Monday one week after the given date's week. */
export function nextMondayISO(iso: string): string {
  const monday = mondayOfISO(iso);
  const [y, m, d] = ymd(monday);
  return toISO(Date.UTC(y, m - 1, d) + 7 * DAY);
}

/** The Monday of the PREVIOUS completed week (this week's Monday minus 7 days). */
export function prevMondayISO(now: Date = new Date()): string {
  const [y, m, d] = ymd(thisMondayISO(now));
  return toISO(Date.UTC(y, m - 1, d) - 7 * DAY);
}

/** A default title like "Week of Aug 4, 2026" for a given Monday. */
export function weekTitleForISO(iso: string): string {
  const [y, m, d] = ymd(iso);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Week of ${label}`;
}

/** A dropdown label like "Week of Jul 13, 2026 (Jul 13 – 19)". */
export function weekLabel(iso: string): string {
  const [y, m, d] = ymd(iso);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  const fmt = (dt: Date, opts: Intl.DateTimeFormatOptions) =>
    dt.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const range =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { day: "numeric" })}`
      : `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { month: "short", day: "numeric" })}`;
  return `${weekTitleForISO(iso)} (${range})`;
}

/** Monday ISO strings from `back` weeks ago to `ahead` weeks ahead. */
export function listWeekMondays(
  back = 3,
  ahead = 8,
  now: Date = new Date(),
): string[] {
  const [y, m, d] = ymd(thisMondayISO(now));
  const base = Date.UTC(y, m - 1, d);
  const weeks: string[] = [];
  for (let i = -back; i <= ahead; i++) {
    weeks.push(toISO(base + i * 7 * DAY));
  }
  return weeks;
}

/**
 * Pick a sensible default week for a new program: the first upcoming week
 * (this week onward) that doesn't already have a program; else this week.
 */
export function defaultNewWeek(usedWeeks: string[], now: Date = new Date()): string {
  const used = new Set(usedWeeks);
  const upcoming = listWeekMondays(0, 8, now);
  return upcoming.find((w) => !used.has(w)) ?? thisMondayISO(now);
}
