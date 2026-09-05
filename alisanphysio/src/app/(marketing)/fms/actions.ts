"use server";
import { getLang } from "@/lib/i18n-server";
import { fmsCopy } from "@/lib/fms-copy";
import { loadFmsAvailability } from "@/lib/fms-data";
import { validFmsSubmission, type FmsSubmission, type FmsConfirmation } from "@/lib/fms";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getFmsSlots() {
  try { return { ok: true as const, ...await loadFmsAvailability() }; }
  catch { return { ok: false as const }; }
}
export async function bookFms(input: FmsSubmission): Promise<
  { ok: true; booking: FmsConfirmation } | { ok: false; taken: boolean; error: string }
> {
  const lang = await getLang(), copy = fmsCopy(lang);
  if (!validFmsSubmission(input)) return { ok: false, taken: false, error: copy.invalid };
  try {
    const { slots } = await loadFmsAvailability();
    const slot = slots.find(s => s.startsAt === new Date(input.starts_at).toISOString());
    if (!slot) return { ok: false, taken: true, error: copy.taken };
    const { data, error } = await createAdminClient().from("fms_bookings").insert({
      full_name: input.full_name.trim(), email: input.email.trim().toLowerCase(),
      starts_at: slot.startsAt, duration_min: slot.durationMin,
      visitor_timezone: input.visitor_timezone, preferred_language: lang,
    }).select("id, starts_at, duration_min, visitor_timezone").single<FmsConfirmation>();
    if (error || !data) return { ok: false, taken: error?.code === "23505", error: error?.code === "23505" ? copy.taken : copy.error };
    return { ok: true, booking: data };
  } catch { return { ok: false, taken: false, error: copy.error }; }
}
