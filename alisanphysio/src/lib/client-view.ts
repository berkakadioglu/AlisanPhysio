import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveAppointmentStatus } from "@/lib/scheduling";
import type { Appointment, ClientAppointment } from "@/lib/types";

/** The client dashboard route family; the staff "view as client" routes mirror it. */
export const DASHBOARD_BASE = "/dashboard";

/** Root of the staff read-only "view as client" routes for one client. */
export function clientViewBase(clientId: string): string {
  return `/admin/clients/${clientId}/view`;
}

/**
 * Client-facing copy of a staff appointment row. The private coach note is
 * dropped and the meeting link is hidden, so the preview never shows either.
 * The input row is not mutated.
 */
export function toClientVisibleAppointment(row: Appointment): ClientAppointment {
  const visible: ClientAppointment & { coach_note?: string | null } = {
    ...row,
    meeting_url: null,
  };
  delete visible.coach_note;
  return visible;
}

/** Earliest appointment that is still active and has not ended yet. */
export function nextUpcomingAppointment(
  appointments: ClientAppointment[],
  nowMs: number,
): ClientAppointment | null {
  return appointments
    .filter(
      (appointment) =>
        isActiveAppointmentStatus(appointment.status) &&
        Date.parse(appointment.starts_at) + appointment.duration_min * 60_000 > nowMs,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null;
}

/**
 * One client's appointments through the staff RPC, mapped to the client shape
 * and sorted newest first. The RPC returns the full row, coach note included,
 * so every row passes through toClientVisibleAppointment.
 */
export async function loadClientAppointmentsForStaff(
  supabase: SupabaseClient,
  clientId: string,
  fromIso: string | null,
): Promise<ClientAppointment[]> {
  const { data, error } = await supabase
    .rpc("get_staff_appointments", {
      p_from: fromIso,
      p_to: null,
      p_client_id: clientId,
      p_appointment_id: null,
    })
    .returns<Appointment[]>();
  if (error) throw new Error("Could not load appointments");
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map(toClientVisibleAppointment)
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
}
