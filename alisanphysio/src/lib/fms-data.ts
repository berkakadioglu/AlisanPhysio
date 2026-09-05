import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFmsSlots, type FmsSettings, type FmsBooking } from "@/lib/fms";
export const FMS_SETTINGS_COLUMNS = "timezone, fms_enabled, fms_days, fms_window_start, fms_window_end, fms_slot_min, fms_min_notice_hours, fms_horizon_days";

/** Server-only service access. Public callers receive slot times, never PII. */
export async function loadFmsAvailability(now = new Date()) {
  const admin = createAdminClient();
  const { data: settings, error } = await admin.from("coach_settings").select(FMS_SETTINGS_COLUMNS).eq("singleton", true).single<FmsSettings>();
  if (error || !settings) throw new Error("FMS settings unavailable");
  if (!settings.fms_enabled) return { slots: [], enabled: false, durationMin: settings.fms_slot_min };
  const booked: Pick<FmsBooking, "starts_at" | "duration_min">[] = [];
  // Avoid Supabase's default response cap hiding occupied slots in a large window.
  for (let offset = 0; ; offset += 1000) {
    const { data, error: bookingError } = await admin.from("fms_bookings").select("starts_at, duration_min")
      .eq("status", "booked").gte("starts_at", new Date(now.getTime() - 180 * 60_000).toISOString())
      .lte("starts_at", new Date(now.getTime() + (settings.fms_horizon_days + 2) * 86_400_000).toISOString())
      .order("starts_at").range(offset, offset + 999).returns<Pick<FmsBooking, "starts_at" | "duration_min">[]>();
    if (bookingError) throw new Error("FMS availability unavailable");
    booked.push(...data ?? []);
    if (!data || data.length < 1000) break;
  }
  return { slots: generateFmsSlots(settings, booked, now), enabled: true, durationMin: settings.fms_slot_min };
}
