"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { weekDays } from "@/lib/availability";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export type SlotInput = {
  dayDate: string;
  timeFrom: string;
  timeTo: string;
  note: string;
};

/**
 * Save (upsert-by-replace) the signed-in client's availability for one request.
 * Runs as the user — RLS scopes every slot write to their own request. All
 * existing slots for the request are deleted and the currently-marked days are
 * re-inserted, which cleanly handles add / remove / edit in one save.
 */
export async function saveAvailability(input: {
  requestId: string;
  slots: SlotInput[];
}): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const lang = await getLang();

  // Verify the request is addressed to THIS user (RLS also enforces it, but this
  // gives a clean error and lets us resolve the right notification).
  const { data: request } = await supabase
    .from("availability_requests")
    .select("id, week_start")
    .eq("id", input.requestId)
    .eq("client_id", userId)
    .maybeSingle<{ id: string; week_start: string }>();
  if (!request) return { ok: false, error: t(lang, "err.availNoRequest") };

  // Keep only days that belong to the request's week (defensive).
  const validDays = new Set(weekDays(request.week_start));
  const rows = input.slots
    .filter((s) => validDays.has(s.dayDate))
    .map((s) => ({
      request_id: request.id,
      day_date: s.dayDate,
      time_from: s.timeFrom.trim() || null,
      time_to: s.timeTo.trim() || null,
      note: s.note.trim() || null,
    }));

  // Replace the request's slots wholesale.
  const { error: delErr } = await supabase
    .from("availability_slots")
    .delete()
    .eq("request_id", request.id);
  if (delErr) return { ok: false, error: delErr.message };

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("availability_slots")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  // Resolve the "when are you free?" nudge for that week.
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("dedupe_key", `availability:${request.week_start}`);

  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard");
  return { ok: true };
}
