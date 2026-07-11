"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLang, t, type Lang } from "@/lib/i18n";
import { isMembership, type Membership } from "@/lib/membership";
import { getLang } from "@/lib/i18n-server";

interface ExerciseInput {
  name: string;
  sets: number | null;
  reps: string | null;
  instructions: string | null;
  media_url: string | null;
  library_id: string | null;
  /** Custom exercise the admin wants to persist to the library for reuse. */
  saveToLibrary?: boolean;
}

interface DayInput {
  title: string; // "" for an untitled/flat day
  exercises: ExerciseInput[];
}

interface SaveProgramInput {
  id?: string; // present when editing
  clientId: string;
  title: string;
  weekStartDate: string; // YYYY-MM-DD
  notes: string;
  days: DayInput[];
}

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

/**
 * Create a client account. This is the ONE operation that needs the
 * service-role client (creating a Supabase Auth user). The service key never
 * leaves the server. Caller is re-verified as an admin first.
 */
export async function createClientAccount(input: {
  fullName: string;
  email: string;
  password: string;
  language?: string;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const lang = await getLang();

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const { password } = input;
  const language: Lang = isLang(input.language) ? input.language : "en";

  if (!fullName) return { ok: false, error: t(lang, "err.enterName") };
  if (!email) return { ok: false, error: t(lang, "err.enterEmail") };
  if (password.length < 8)
    return { ok: false, error: t(lang, "err.passwordShort") };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no inbox needed — they can log in immediately
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { ok: false, error: t(lang, "err.emailTaken") };
    }
    return { ok: false, error: error.message };
  }

  // Store the client's UI language (best-effort; skipped if the column doesn't
  // exist yet, so client creation still works before migration 0004 is run).
  if (data.user) {
    await supabase
      .from("profiles")
      .update({ language })
      .eq("id", data.user.id);
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** Create or update a program with its optional days and exercises. Uses the
 *  admin's own session (RLS *_admin_all policies authorize it) — no service
 *  role needed. Days + exercises are replaced wholesale on edit, which cleanly
 *  handles add/remove/reorder at both levels. */
export async function saveProgram(
  input: SaveProgramInput,
): Promise<ActionResult<{ programId: string }>> {
  const { supabase } = await requireAdmin();
  const lang = await getLang();

  const title = input.title.trim();
  const weekStartDate = input.weekStartDate;
  if (!title) return { ok: false, error: t(lang, "err.giveTitle") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate))
    return { ok: false, error: t(lang, "err.pickDate") };

  // Keep days that have a title or at least one named exercise.
  const days = input.days
    .map((d) => ({
      title: d.title.trim(),
      exercises: d.exercises.filter((e) => e.name.trim() !== ""),
    }))
    .filter((d) => d.title !== "" || d.exercises.length > 0);

  let programId = input.id;

  if (programId) {
    const { error } = await supabase
      .from("programs")
      .update({ title, week_start_date: weekStartDate, notes: input.notes.trim() || null })
      .eq("id", programId);
    if (error) return { ok: false, error: error.message };

    // Replace exercises then days (exercises reference days).
    const { error: exDelErr } = await supabase
      .from("exercises")
      .delete()
      .eq("program_id", programId);
    if (exDelErr) return { ok: false, error: exDelErr.message };
    const { error: dayDelErr } = await supabase
      .from("program_days")
      .delete()
      .eq("program_id", programId);
    if (dayDelErr) return { ok: false, error: dayDelErr.message };
  } else {
    const { data, error } = await supabase
      .from("programs")
      .insert({
        client_id: input.clientId,
        title,
        week_start_date: weekStartDate,
        notes: input.notes.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not create program." };
    }
    programId = data.id as string;
  }

  // Insert days, then their exercises (with the new day_id + ordering).
  const exerciseRows: Array<Record<string, unknown>> = [];

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const { data: dayRow, error: dayErr } = await supabase
      .from("program_days")
      .insert({
        program_id: programId,
        title: day.title || null,
        order_index: di,
      })
      .select("id")
      .single();
    if (dayErr || !dayRow) {
      return { ok: false, error: dayErr?.message ?? "Could not save a day." };
    }
    const dayId = dayRow.id as string;

    for (let ei = 0; ei < day.exercises.length; ei++) {
      const e = day.exercises[ei];
      const name = e.name.trim();
      const instructions = e.instructions?.trim() || null;
      let libraryId = e.library_id;

      // "Save to library" for a custom exercise → resolve/create the entry.
      if (!libraryId && e.saveToLibrary) {
        const { data: existing } = await supabase
          .from("exercise_library")
          .select("id")
          .eq("name", name)
          .maybeSingle();
        if (existing) {
          libraryId = existing.id as string;
        } else {
          const { data: created } = await supabase
            .from("exercise_library")
            .insert({ name, default_instructions: instructions })
            .select("id")
            .single();
          if (created) libraryId = created.id as string;
        }
      }

      exerciseRows.push({
        program_id: programId,
        day_id: dayId,
        name,
        sets: e.sets,
        reps: e.reps?.trim() || null,
        instructions,
        media_url: e.media_url?.trim() || null,
        library_id: libraryId ?? null,
        order_index: ei,
      });
    }
  }

  if (exerciseRows.length > 0) {
    const { error } = await supabase.from("exercises").insert(exerciseRows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true, programId: programId! };
}

/** Delete a program (days + exercises cascade). */
export async function deleteProgram(input: {
  programId: string;
  clientId: string;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", input.programId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true };
}

/**
 * Set a new password for a client. Needs the service-role admin client
 * (updating an auth user), which stays server-only. Caller is re-verified as
 * an admin first.
 */
export async function resetClientPassword(input: {
  clientId: string;
  password: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const lang = await getLang();

  if (input.password.length < 8) {
    return { ok: false, error: t(lang, "err.passwordShort") };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.clientId, {
    password: input.password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Update a client's name, email, language, height, and membership tier.
 * Changing the auth email needs the service-role admin client (server-only);
 * the profile fields go through the admin's own session (RLS *_admin_all).
 * Never touches role. Admin-gated — membership is admin-only by design
 * (see the profiles guard trigger in migration 0006).
 */
export async function updateClient(input: {
  clientId: string;
  fullName: string;
  email: string;
  language?: string;
  height?: string;
  membership?: string | null;
  membershipEndDate?: string | null;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const lang = await getLang();

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const language: Lang = isLang(input.language) ? input.language : "en";
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: t(lang, "err.emailInvalid") };
  }

  // Height: blank → null; otherwise a number in a sane range.
  const heightRaw = (input.height ?? "").trim().replace(",", ".");
  let height: number | null = null;
  if (heightRaw !== "") {
    const n = Number(heightRaw);
    if (!Number.isFinite(n) || n < 50 || n > 260) {
      return { ok: false, error: t(lang, "err.heightRange") };
    }
    height = n;
  }

  // Membership: only the four tiers, else null (= no membership).
  const membership: Membership | null = isMembership(input.membership)
    ? input.membership
    : null;

  // Membership end date: blank → null; otherwise a valid YYYY-MM-DD.
  const endRaw = (input.membershipEndDate ?? "").trim();
  let membershipEndDate: string | null = null;
  if (endRaw !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endRaw) || Number.isNaN(Date.parse(endRaw))) {
      return { ok: false, error: t(lang, "err.endDate") };
    }
    membershipEndDate = endRaw;
  }
  // No expiry without a tier — clearing membership clears its end date too.
  if (membership === null) membershipEndDate = null;

  // Email lives in the auth schema → service-role, server-only.
  const admin = createAdminClient();
  const { error: emailErr } = await admin.auth.admin.updateUserById(
    input.clientId,
    { email, email_confirm: true },
  );
  if (emailErr) {
    const msg = emailErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { ok: false, error: t(lang, "err.emailInUse") };
    }
    return { ok: false, error: emailErr.message };
  }

  // Profile fields via the admin's own session (RLS *_admin_all authorizes it).
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      language,
      height_cm: height,
      membership,
      membership_end_date: membershipEndDate,
    })
    .eq("id", input.clientId);
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath(`/admin/clients/${input.clientId}/data`);
  return { ok: true };
}

/**
 * Permanently delete a CLIENT and everything they own. Deleting the Supabase
 * Auth user cascades to profiles → programs/measurements/complaints (and their
 * children) via on-delete-cascade FKs. Needs the service-role admin client
 * (server-only). Admin-gated, and scoped to role='client' so this client-facing
 * action can never delete an admin/manager account.
 */
export async function deleteClient(input: {
  clientId: string;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const lang = await getLang();

  // Verify the target is a client before touching the service-role API.
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", input.clientId)
    .maybeSingle<{ role: string }>();
  if (!target || target.role !== "client") {
    return { ok: false, error: t(lang, "err.notAClient") };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(input.clientId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
