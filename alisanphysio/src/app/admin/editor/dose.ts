import { t, type Lang } from "@/lib/i18n";
import { parseYouTubeId } from "@/lib/youtube";

/**
 * Pure helpers behind the editor's exercise rows (no React, so the Node tests
 * can load them): the dose pill, the reps quick chips, list reordering, the
 * duplicate-in-day check, the video source line and the library search.
 */

/** The two halves of the dose pill: the set count (shown bold) and the rest. */
export interface DoseParts {
  /** The set count as text, or null when sets aren't specified. */
  sets: string | null;
  /** Everything after the set count ("× 8–12 each side", " sets"), or the reps alone. */
  rest: string;
}

/**
 * Split a prescription into the pill's parts:
 * sets + reps → { sets: "1", rest: " × 8–12 each side" };
 * sets only  → { sets: "3", rest: " sets" } (TR " set" — no plural after numbers);
 * reps only  → { sets: null, rest: "8–12" };
 * neither    → { sets: null, rest: "" } (callers show no pill).
 * The reps text is kept intact (only trimmed) — the pill truncates it visually.
 */
export function doseParts(sets: number | null, reps: string | null, lang: Lang): DoseParts {
  const r = reps?.trim() ?? "";
  if (sets == null) return { sets: null, rest: r };
  const n = String(sets);
  if (r) return { sets: n, rest: ` × ${r}` };
  // The effort.set(s) templates start with "{sets}"; keep whatever follows it.
  const template = t(lang, Math.abs(sets) === 1 ? "effort.set" : "effort.sets");
  const at = template.indexOf("{sets}");
  return { sets: n, rest: at >= 0 ? template.slice(at + "{sets}".length) : ` ${template}` };
}

/** The pill as one plain string (its tooltip / accessible text). */
export function doseText(parts: DoseParts): string {
  return `${parts.sets ?? ""}${parts.rest}`.trim();
}

/**
 * Append a quick-chip text to the reps field with exactly one separating
 * space ("3–5" + "sec hold" → "3–5 sec hold"). Trailing whitespace is dropped
 * first so there are never double spaces, and a chip already at the end isn't
 * repeated ("8 each side" + "each side" stays as is).
 */
export function appendChip(reps: string | null, chip: string): string {
  const base = (reps ?? "").replace(/\s+$/u, "");
  const text = chip.trim();
  if (!text) return base;
  if (!base) return text;
  if (base.toLowerCase().endsWith(text.toLowerCase())) {
    const before = base.slice(0, base.length - text.length);
    // Only a whole-word match counts ("eachside" is not "each side").
    if (before === "" || /\s$/u.test(before)) return base;
  }
  return `${base} ${text}`;
}

/**
 * Move one item to another position. Returns a new array, or the SAME array
 * when nothing would change (out of range or from === to) so callers can skip
 * a no-op update.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const n = list.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return list as T[];
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where a dragged row lands: `mids` are the vertical midpoints of every row
 * (in their pre-drag positions) and `probe` the dragged row's LEADING edge
 * (its bottom while moving down, its top while moving up — see dragTarget).
 * The row passes a neighbour once that edge crosses the neighbour's midpoint.
 */
export function dropIndex(mids: readonly number[], from: number, probe: number): number {
  let to = from;
  for (let i = from + 1; i < mids.length; i++) if (probe > mids[i]) to = i;
  for (let i = from - 1; i >= 0; i--) if (probe < mids[i]) to = i;
  return to;
}

/**
 * One step of a pointer drag: clamp the raw pointer offset `rawDy` so the
 * dragged row stays inside the list, then find its drop slot by probing with
 * the row's leading edge. Probing with the leading edge (not the centre) is
 * what lets a row reach the very first / last slot at the clamp limit, and
 * lets a tall (expanded) row move past short neighbours at all.
 * `tops` / `heights` are the rows' pre-drag positions.
 */
export function dragTarget(
  tops: readonly number[],
  heights: readonly number[],
  from: number,
  rawDy: number,
): { dy: number; to: number } {
  const last = tops.length - 1;
  if (last < 0 || from < 0 || from > last) return { dy: 0, to: from };
  const minDy = tops[0] - tops[from];
  const maxDy = tops[last] + heights[last] - (tops[from] + heights[from]);
  const dy = Math.min(maxDy, Math.max(minDy, rawDy));
  const top = tops[from] + dy;
  const probe = dy > 0 ? top + heights[from] : dy < 0 ? top : top + heights[from] / 2;
  const mids = tops.map((t, i) => t + heights[i] / 2);
  return { dy, to: dropIndex(mids, from, probe) };
}

/**
 * Keep a remembered row order that also holds REMOVED rows ("ghosts"), so
 * several removals can be undone in any order. `memo` is the remembered
 * order, `current` the live keys. When the live rows that the memo knows are
 * still in the memo's order, the memo is kept (with any new live keys slotted
 * in after their live predecessor); after a reorder it restarts from
 * `current` (the ghosts are forgotten and Undo falls back to neighbours).
 */
export function mergeOrder(memo: readonly string[], current: readonly string[]): string[] {
  const pos = new Map(memo.map((k, i) => [k, i]));
  let last = -1;
  for (const k of current) {
    const p = pos.get(k);
    if (p === undefined) continue;
    if (p < last) return current.slice();
    last = p;
  }
  const out = memo.slice();
  current.forEach((k, i) => {
    if (pos.has(k)) return;
    out.splice(i > 0 ? out.indexOf(current[i - 1]) + 1 : 0, 0, k);
  });
  return out;
}

/**
 * Put a removed row back for Undo. With a remembered `order` (see
 * mergeOrder) that still contains the row, it goes right after the nearest
 * live row that preceded it there (else before the nearest live row that
 * followed it) — so undoing several removals in either order restores the
 * original order. Otherwise it returns next to the neighbour it had when it
 * was removed (after `prevKey`, else before `nextKey`), else at its old index
 * (clamped). A row already in the list is not added twice (same array back).
 */
export function restoreRemoved<T extends { key: string }>(
  list: readonly T[],
  row: T,
  at: { index: number; prevKey: string | null; nextKey: string | null },
  order?: readonly string[] | null,
): T[] {
  if (list.some((e) => e.key === row.key)) return list as T[];
  const live = new Map(list.map((e, i) => [e.key, i]));
  let pos = -1;
  const o = order ? order.indexOf(row.key) : -1;
  if (order && o >= 0) {
    for (let i = o - 1; i >= 0 && pos < 0; i--) {
      const p = live.get(order[i]);
      if (p !== undefined) pos = p + 1;
    }
    for (let i = o + 1; i < order.length && pos < 0; i++) {
      const p = live.get(order[i]);
      if (p !== undefined) pos = p;
    }
  }
  if (pos < 0) {
    const p = at.prevKey ? live.get(at.prevKey) : undefined;
    const n = at.nextKey ? live.get(at.nextKey) : undefined;
    pos = p !== undefined ? p + 1 : n !== undefined ? n : Math.max(0, Math.min(at.index, list.length));
  }
  const next = list.slice();
  next.splice(pos, 0, row);
  return next;
}

/**
 * The reps/time field is one logical line even though it wraps visually:
 * typed or pasted line breaks become a single space.
 */
export function singleLine(s: string): string {
  return s.replace(/[ \t]*[\r\n]+[ \t]*/g, " ");
}

/**
 * Deep link to one library entry: the library page opens that entry's edit
 * dialog (`edit`) and pre-fills its search with the name (`q`), so closing
 * the dialog leaves the list narrowed to it.
 */
export function libraryEntryHref(entry: { id: string; name: string }): string {
  const params = new URLSearchParams({ edit: entry.id });
  const name = entry.name.trim();
  if (name) params.set("q", name);
  return `/admin/library?${params.toString()}`;
}

/** Minimal shape for the duplicate check (an exercise draft fits). */
interface DuplicateKeyed {
  name: string;
  library_id: string | null;
}

function duplicateKeys(row: DuplicateKeyed): string[] {
  const keys: string[] = [];
  if (row.library_id) keys.push(`lib:${row.library_id}`);
  const name = row.name.trim().toLowerCase();
  if (name) keys.push(`name:${name}`);
  return keys;
}

/**
 * For each row, whether an EARLIER row in the same day links the same library
 * entry or has the same (trimmed, case-insensitive) name. Non-blocking — the
 * editor only warns.
 */
export function duplicateFlags(rows: readonly DuplicateKeyed[]): boolean[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const keys = duplicateKeys(row);
    const duplicate = keys.some((k) => seen.has(k));
    for (const k of keys) seen.add(k);
    return duplicate;
  });
}

/** Which video a row shows and where it comes from (see effectiveVideoId).
 *  A non-YouTube http(s) override is "none" here; see externalVideoUrl for
 *  the link the client gets instead. */
export type VideoSource = "override" | "library" | "none";

export function videoSource(
  overrideUrl: string | null | undefined,
  libraryUrl: string | null | undefined,
): VideoSource {
  if (parseYouTubeId(overrideUrl)) return "override";
  if (parseYouTubeId(libraryUrl)) return "library";
  return "none";
}

/** Case- and accent-insensitive search text ("Şınav" matches "sinav", "İ" → "i"). */
export function foldSearch(s: string): string {
  return s
    .replace(/[İIı]/gu, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}
