"use server";
import { requireStaff } from "@/lib/admin-auth";
import { FMS_STATUSES, validFmsSettings, type FmsSettingsInput, type FmsStatus } from "@/lib/fms";
import { revalidatePath } from "next/cache";
export async function updateFmsBooking(input: { id: string; status: FmsStatus; admin_note: string }) {
  const { supabase } = await requireStaff();
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.id) || !FMS_STATUSES.includes(input.status)
    || typeof input.admin_note !== "string" || input.admin_note.length > 4000) return { ok: false, taken: false };
  const { data, error } = await supabase.from("fms_bookings").update({ status: input.status, admin_note: input.admin_note.trim() || null }).eq("id", input.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, taken: error?.code === "23505" };
  revalidatePath("/admin", "layout"); revalidatePath("/fms"); return { ok: true };
}
export async function updateFmsSettings(input: FmsSettingsInput) {
  const { supabase } = await requireStaff();
  if (!validFmsSettings(input)) return false;
  // Explicit allowlist: never modify scheduling_mode, coach_id or client settings.
  const { data, error } = await supabase.from("coach_settings").update({
    fms_enabled: input.fms_enabled, fms_days: input.fms_days,
    fms_window_start: input.fms_window_start, fms_window_end: input.fms_window_end,
    fms_slot_min: input.fms_slot_min, fms_min_notice_hours: input.fms_min_notice_hours,
    fms_horizon_days: input.fms_horizon_days,
  }).eq("singleton", true).select("singleton").maybeSingle();
  if (error || !data) return false;
  revalidatePath("/admin/fms"); revalidatePath("/fms"); return true;
}
