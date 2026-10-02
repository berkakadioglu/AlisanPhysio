"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTimeZone } from "@/lib/scheduling";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every action here runs as the SIGNED-IN CLIENT using their own Supabase
 * session — never the service role. Row Level Security guarantees a client can
 * only ever read/write their OWN profile, measurements and complaints, so we
 * scope writes by the authenticated user id and let RLS enforce the rest.
 */
async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/** Parse a free-text number field into a positive number or null (blank). */
function parseNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN as unknown as number;
}

/** Update the client's own name + standing height. */
export async function updatePersonalInfo(input: {
  fullName: string;
  height: string;
  timezone: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const lang = await getLang();

  const fullName = input.fullName.trim();
  const height = parseNum(input.height);
  if (Number.isNaN(height)) {
    return { ok: false, error: t(lang, "err.heightRange") };
  }
  if (height !== null && (height < 50 || height > 260)) {
    return { ok: false, error: t(lang, "err.heightRange") };
  }
  const timezone = input.timezone.trim() || null;
  if (timezone !== null && !isValidTimeZone(timezone)) {
    return { ok: false, error: t(lang, "err.timezoneInvalid") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, height_cm: height, timezone })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * The logged-in user changing their OWN password. Uses their session — no
 * service role needed (Supabase authorizes updateUser via the access token).
 */
export async function changeOwnPassword(input: {
  password: string;
}): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const lang = await getLang();

  if (input.password.length < 8) {
    return { ok: false, error: t(lang, "err.passwordShort") };
  }
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Add a measurement for the signed-in client. */
export async function addMeasurement(input: {
  measuredOn: string;
  weight: string;
  waist: string;
  hip: string;
  arm: string;
  chest: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const lang = await getLang();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.measuredOn)) {
    return { ok: false, error: t(lang, "err.measurementDate") };
  }
  const nums = {
    weight_kg: parseNum(input.weight),
    waist_cm: parseNum(input.waist),
    hip_cm: parseNum(input.hip),
    arm_cm: parseNum(input.arm),
    chest_cm: parseNum(input.chest),
  };
  if (Object.values(nums).some((n) => Number.isNaN(n))) {
    return { ok: false, error: t(lang, "err.numberRange") };
  }
  // Weight is the one required field; the circumferences are optional.
  if (nums.weight_kg == null) {
    return { ok: false, error: t(lang, "err.weightRequired") };
  }

  const { error } = await supabase.from("measurements").insert({
    client_id: userId,
    measured_on: input.measuredOn,
    ...nums,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * Delete one of the signed-in user's own measurements. Scoped to their id as
 * well as by RLS, and checked by the returned row: a delete that matches
 * nothing (already removed, or not theirs) is reported, never shown as done.
 */
export async function deleteMeasurement(input: { id: string }): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const lang = await getLang();
  const { data, error } = await supabase
    .from("measurements")
    .delete()
    .eq("id", input.id)
    .eq("client_id", userId)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("[profile] measurement delete failed", error);
    return { ok: false, error: t(lang, "err.measurementDelete") };
  }
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/** Add a timestamped complaint / note for the signed-in client. */
export async function addComplaint(input: { body: string }): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const lang = await getLang();

  const body = input.body.trim();
  if (!body) return { ok: false, error: t(lang, "err.emptyNote") };

  const { error } = await supabase
    .from("complaints")
    .insert({ client_id: userId, body });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/** Delete one of the signed-in user's own complaints (same checks as above). */
export async function deleteComplaint(input: { id: string }): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const lang = await getLang();
  const { data, error } = await supabase
    .from("complaints")
    .delete()
    .eq("id", input.id)
    .eq("client_id", userId)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("[profile] note delete failed", error);
    return { ok: false, error: t(lang, "err.noteDelete") };
  }
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
