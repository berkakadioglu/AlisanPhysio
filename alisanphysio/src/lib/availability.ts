import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AvailabilityRequest,
  AvailabilityRequestWithSlots,
  AvailabilitySlot,
} from "@/lib/types";
import { mondayOfISO } from "@/lib/program-dates";

const DAY = 86_400_000;
const REQUEST_COLS = "id, client_id, week_start, created_by, created_at";
const SLOT_COLS = "id, request_id, day_date, time_from, time_to, note, created_at";

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** The 7 ISO day-dates (Mon→Sun) of the week starting at `weekStart` (a Monday). */
export function weekDays(weekStart: string): string[] {
  const [y, m, d] = ymd(mondayOfISO(weekStart));
  const base = Date.UTC(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(base + i * DAY).toISOString().slice(0, 10),
  );
}

/** Order slots by day, then by start time — a stable, readable reading order. */
export function sortSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort(
    (a, b) =>
      a.day_date.localeCompare(b.day_date) ||
      (a.time_from ?? "").localeCompare(b.time_from ?? ""),
  );
}

/**
 * Load a single client's availability request for one week plus its slots.
 * Runs as the signed-in user (RLS scopes to their own request/slots) OR as
 * staff (who may read anyone's). Returns null if there's no request.
 */
export async function loadRequestForWeek(
  supabase: SupabaseClient,
  clientId: string,
  weekStart: string,
): Promise<AvailabilityRequestWithSlots | null> {
  const { data: request } = await supabase
    .from("availability_requests")
    .select(REQUEST_COLS)
    .eq("client_id", clientId)
    .eq("week_start", weekStart)
    .maybeSingle<AvailabilityRequest>();
  if (!request) return null;

  const { data: slots } = await supabase
    .from("availability_slots")
    .select(SLOT_COLS)
    .eq("request_id", request.id)
    .returns<AvailabilitySlot[]>();

  return { ...request, slots: sortSlots(slots ?? []) };
}

/**
 * The signed-in client's availability requests (newest week first), each with
 * its submitted slots. RLS scopes this to the caller's own requests.
 */
export async function loadOwnRequests(
  supabase: SupabaseClient,
  clientId: string,
): Promise<AvailabilityRequestWithSlots[]> {
  const { data: requests } = await supabase
    .from("availability_requests")
    .select(REQUEST_COLS)
    .eq("client_id", clientId)
    .order("week_start", { ascending: false })
    .returns<AvailabilityRequest[]>();

  const list = requests ?? [];
  if (list.length === 0) return [];

  const { data: slots } = await supabase
    .from("availability_slots")
    .select(SLOT_COLS)
    .in(
      "request_id",
      list.map((r) => r.id),
    )
    .returns<AvailabilitySlot[]>();

  const byRequest = new Map<string, AvailabilitySlot[]>();
  for (const s of slots ?? []) {
    const arr = byRequest.get(s.request_id) ?? [];
    arr.push(s);
    byRequest.set(s.request_id, arr);
  }
  return list.map((r) => ({ ...r, slots: sortSlots(byRequest.get(r.id) ?? []) }));
}

/**
 * A small dashboard entry point: the client's most relevant PENDING request —
 * a current-or-future week they haven't answered yet (no slots). Returns null
 * when there's nothing to nudge about.
 */
export function pendingRequest(
  requests: AvailabilityRequestWithSlots[],
  todayMonday: string,
): AvailabilityRequestWithSlots | null {
  const pending = requests
    .filter((r) => r.week_start >= todayMonday && r.slots.length === 0)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  return pending[0] ?? null;
}

/**
 * All availability requests for one week (staff view), each with its slots.
 * Staff read every request via RLS (availability_requests_staff_all).
 */
export async function loadWeekRequests(
  supabase: SupabaseClient,
  weekStart: string,
): Promise<AvailabilityRequestWithSlots[]> {
  const { data: requests } = await supabase
    .from("availability_requests")
    .select(REQUEST_COLS)
    .eq("week_start", weekStart)
    .returns<AvailabilityRequest[]>();

  const list = requests ?? [];
  if (list.length === 0) return [];

  const { data: slots } = await supabase
    .from("availability_slots")
    .select(SLOT_COLS)
    .in(
      "request_id",
      list.map((r) => r.id),
    )
    .returns<AvailabilitySlot[]>();

  const byRequest = new Map<string, AvailabilitySlot[]>();
  for (const s of slots ?? []) {
    const arr = byRequest.get(s.request_id) ?? [];
    arr.push(s);
    byRequest.set(s.request_id, arr);
  }
  return list.map((r) => ({ ...r, slots: sortSlots(byRequest.get(r.id) ?? []) }));
}
