import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Appointment,
  AppointmentWithClient,
  BookableAvailabilitySlot,
  ClientAppointment,
  ClientProposal,
  ClientProposalWithClient,
  CoachSettings,
  SchedulingClientSummary,
} from "@/lib/types";

const COACH_SETTINGS_COLUMNS =
  "scheduling_mode, default_duration_min, timezone";
const SLOT_COLUMNS =
  "id, created_at, starts_at, duration_min, status, note";
const PROPOSAL_COLUMNS =
  "id, created_at, client_id, proposal_group_id, proposed_start, note, status, decision_note, decided_at, accepted_appointment_id";
const CLIENT_COLUMNS = "id, full_name, timezone";

export interface UtcSchedulingRange {
  /** Inclusive UTC timestamptz/ISO boundary. */
  startsAt: string;
  /** Exclusive UTC timestamptz/ISO boundary. */
  endsAt: string;
}

export interface ClientSchedulingData {
  settings: CoachSettings | null;
  appointments: ClientAppointment[];
  openSlots: BookableAvailabilitySlot[];
  proposals: ClientProposal[];
}

export interface StaffSchedulingData {
  settings: CoachSettings | null;
  appointments: AppointmentWithClient[];
  slots: BookableAvailabilitySlot[];
  pendingAppointments: AppointmentWithClient[];
  pendingProposals: ClientProposalWithClient[];
}

function assertUtcRange(range: UtcSchedulingRange): void {
  const start = Date.parse(range.startsAt);
  const end = Date.parse(range.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new RangeError("Invalid UTC scheduling range");
  }
}

function throwReadError(
  error: { message: string } | null,
  context: string,
): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Read the single coach-settings row. The caller's RLS policy still applies. */
export async function loadCoachSettings(
  supabase: SupabaseClient,
): Promise<CoachSettings | null> {
  const { data, error } = await supabase
    .from("coach_settings")
    .select(COACH_SETTINGS_COLUMNS)
    .limit(1)
    .maybeSingle<CoachSettings>();
  throwReadError(error, "Could not load coach scheduling settings");
  return data;
}

/** Open Mode-A slots whose starts fall inside an explicit UTC range. */
export async function loadOpenAvailabilitySlots(
  supabase: SupabaseClient,
  range: UtcSchedulingRange,
): Promise<BookableAvailabilitySlot[]> {
  assertUtcRange(range);
  const { data, error } = await supabase
    .from("availability_slots")
    .select(SLOT_COLUMNS)
    .eq("status", "open")
    .gte("starts_at", range.startsAt)
    .lt("starts_at", range.endsAt)
    .order("starts_at", { ascending: true })
    .returns<BookableAvailabilitySlot[]>();
  throwReadError(error, "Could not load open availability slots");
  return data ?? [];
}

/** All appointments visible to one signed-in client, newest first. */
export async function loadOwnAppointments(
  supabase: SupabaseClient,
  _clientId: string,
): Promise<ClientAppointment[]> {
  // Ownership is derived from auth.uid() inside the RPC. Keep this argument for
  // compatibility with callers that also use explicitly-scoped legacy loaders.
  void _clientId;
  const { data, error } = await supabase
    .rpc("get_own_appointments", { p_from: null, p_to: null })
    .returns<ClientAppointment[]>();
  throwReadError(error, "Could not load appointments");
  const rows = Array.isArray(data) ? (data as ClientAppointment[]) : [];
  return [...rows].sort(
    (a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at),
  );
}

/** All proposals visible to one signed-in client, newest first. */
export async function loadOwnClientProposals(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientProposal[]> {
  const { data, error } = await supabase
    .from("client_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("client_id", clientId)
    .order("proposed_start", { ascending: false })
    .returns<ClientProposal[]>();
  throwReadError(error, "Could not load appointment proposals");
  return data ?? [];
}

/** One client-facing schedule snapshot, with independent range for open slots. */
export async function loadClientSchedulingData(
  supabase: SupabaseClient,
  clientId: string,
  openSlotRange: UtcSchedulingRange,
): Promise<ClientSchedulingData> {
  const [settings, appointments, openSlots, proposals] = await Promise.all([
    loadCoachSettings(supabase),
    loadOwnAppointments(supabase, clientId),
    loadOpenAvailabilitySlots(supabase, openSlotRange),
    loadOwnClientProposals(supabase, clientId),
  ]);
  return { settings, appointments, openSlots, proposals };
}

/** Staff slots (all statuses) inside a UTC week/calendar range. */
export async function loadStaffAvailabilitySlots(
  supabase: SupabaseClient,
  range: UtcSchedulingRange,
): Promise<BookableAvailabilitySlot[]> {
  assertUtcRange(range);
  const { data, error } = await supabase
    .from("availability_slots")
    .select(SLOT_COLUMNS)
    .gte("starts_at", range.startsAt)
    .lt("starts_at", range.endsAt)
    .order("starts_at", { ascending: true })
    .returns<BookableAvailabilitySlot[]>();
  throwReadError(error, "Could not load staff availability slots");
  return data ?? [];
}

/** Staff appointments in a UTC range, including each client's local timezone. */
export async function loadStaffAppointments(
  supabase: SupabaseClient,
  range: UtcSchedulingRange,
): Promise<AppointmentWithClient[]> {
  assertUtcRange(range);
  const { data, error } = await supabase
    .rpc("get_staff_appointments", {
      p_from: range.startsAt,
      p_to: range.endsAt,
      p_client_id: null,
      p_appointment_id: null,
    })
    .returns<Appointment[]>();
  throwReadError(error, "Could not load staff appointments");
  const rows = Array.isArray(data) ? (data as Appointment[]) : [];
  return attachClientSummaries(supabase, rows);
}

/** The Mode-A pending booking queue is global, not clipped to the current week. */
export async function loadPendingAppointments(
  supabase: SupabaseClient,
): Promise<AppointmentWithClient[]> {
  const { data, error } = await supabase
    .rpc("get_staff_appointments", {
      p_from: null,
      p_to: null,
      p_client_id: null,
      p_appointment_id: null,
    })
    .returns<Appointment[]>();
  throwReadError(error, "Could not load pending appointments");
  const rows = Array.isArray(data) ? (data as Appointment[]) : [];
  return attachClientSummaries(
    supabase,
    rows
      .filter((appointment) => appointment.status === "pending")
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
  );
}

/** The mode-B queue is global, rather than clipped to the visible calendar. */
export async function loadPendingClientProposals(
  supabase: SupabaseClient,
): Promise<ClientProposalWithClient[]> {
  const { data, error } = await supabase
    .from("client_proposals")
    .select(`${PROPOSAL_COLUMNS}, client:profiles!client_proposals_client_id_fkey(${CLIENT_COLUMNS})`)
    .eq("status", "pending")
    .order("proposed_start", { ascending: true })
    .returns<ClientProposalWithClient[]>();
  throwReadError(error, "Could not load pending client proposals");
  return data ?? [];
}

/** Week/calendar data and the pending queue for the staff scheduling screen. */
export async function loadStaffSchedulingData(
  supabase: SupabaseClient,
  range: UtcSchedulingRange,
): Promise<StaffSchedulingData> {
  const [settings, appointments, slots, pendingAppointments, pendingProposals] =
    await Promise.all([
      loadCoachSettings(supabase),
      loadStaffAppointments(supabase, range),
      loadStaffAvailabilitySlots(supabase, range),
      loadPendingAppointments(supabase),
      loadPendingClientProposals(supabase),
    ]);
  return { settings, appointments, slots, pendingAppointments, pendingProposals };
}

/** Read a profile timezone/name when rendering coach-side secondary local time. */
export async function loadSchedulingClientSummary(
  supabase: SupabaseClient,
  clientId: string,
): Promise<SchedulingClientSummary | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .maybeSingle<SchedulingClientSummary>();
  throwReadError(error, "Could not load scheduling client profile");
  return data;
}

async function attachClientSummaries(
  supabase: SupabaseClient,
  appointments: Appointment[],
): Promise<AppointmentWithClient[]> {
  const ids = [...new Set(appointments.map((appointment) => appointment.client_id))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(CLIENT_COLUMNS)
    .in("id", ids)
    .returns<SchedulingClientSummary[]>();
  throwReadError(error, "Could not load scheduling client profiles");
  const byId = new Map((data ?? []).map((client) => [client.id, client]));
  return appointments.map((appointment) => ({
    ...appointment,
    client: byId.get(appointment.client_id) ?? null,
  }));
}
