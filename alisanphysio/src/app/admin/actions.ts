"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLang, t, type Lang } from "@/lib/i18n";
import { isMembership, type Membership } from "@/lib/membership";
import { isMonthStart } from "@/lib/month";
import { getLang } from "@/lib/i18n-server";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "manager", "client"];

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
  /** Name of the saved day this day was copied from (origin line only). */
  sourceTemplateLabel?: string | null;
  exercises: ExerciseInput[];
}

interface SaveProgramInput {
  id?: string; // present when editing
  kind: "client" | "catalog";
  clientId: string | null;
  title: string;
  monthStartDate: string | null;
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
  const { supabase } = await requireStaff();
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

/** One RPC transaction replaces the programme, including optional library inserts. */
export async function saveProgram(input: SaveProgramInput): Promise<ActionResult<{ programId: string }>> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  if (!input.title.trim() || input.title.length > 300) return { ok: false, error: t(lang, "err.giveTitle") };
  if (input.kind === "client" && (!input.clientId || !isMonthStart(input.monthStartDate)))
    return { ok: false, error: t(lang, "err.pickDate") };
  if (input.kind === "catalog" && (input.clientId !== null || input.monthStartDate !== null))
    return { ok: false, error: t(lang, "err.programShape") };
  // `source_template_label` is informational text (0021 stores it; older RPCs
  // ignore unknown keys), so it is trimmed and capped, never trusted as a link.
  const days = input.days.map((day) => ({
    title: day.title.trim(),
    source_template_label: day.sourceTemplateLabel?.trim().slice(0, 200) || null,
    exercises: day.exercises.filter((ex) => ex.name.trim()).map((ex) => ({ ...ex, name: ex.name.trim() })),
  })).filter((day) => day.title || day.exercises.length);
  if (days.some((day) => day.exercises.some((ex) => ex.sets !== null && (!Number.isInteger(ex.sets) || ex.sets < 0))))
    return { ok: false, error: t(lang, "err.programSets") };
  const { data, error } = await supabase.rpc("save_program", {
    p_id: input.id ?? null, p_kind: input.kind, p_client_id: input.clientId,
    p_month_start_date: input.monthStartDate, p_title: input.title, p_notes: input.notes, p_days: days,
  });
  if (error) {
    const key = error.code === "23505" ? "err.programMonthTaken"
      : error.message.includes("program_reviewed_month_locked") ? "err.programMonthLocked"
      : error.code === "23514" ? "err.programShape" : "err.programSave";
    return { ok: false, error: t(lang, key) };
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/programs");
  if (input.clientId) revalidatePath(`/admin/clients/${input.clientId}`);
  else revalidatePath(`/admin/programs/${data}/edit`);
  return { ok: true, programId: data as string };
}

/** Delete a program (days + exercises cascade). */
export async function deleteProgram(input: {
  programId: string;
  clientId: string | null;
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", input.programId);
  if (error) return { ok: false, error: error.message };

  if (input.clientId) revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin");
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
  await requireStaff();
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
  const { supabase } = await requireStaff();
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

/**
 * Assign a role (admin / manager / client) to a user. ADMIN ONLY — the one
 * thing a manager must never do. Enforced here by requireAdmin AND at the DB
 * level by the profiles guard trigger (only is_admin() may change role).
 * Refuses to change the caller's OWN role, to avoid an accidental self-lockout.
 */
export async function assignRole(input: {
  userId: string;
  role: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireAdmin();
  const lang = await getLang();

  if (!ROLES.includes(input.role as Role)) {
    return { ok: false, error: t(lang, "err.invalidRole") };
  }
  if (input.userId === userId) {
    return { ok: false, error: t(lang, "err.cantChangeOwnRole") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: input.role })
    .eq("id", input.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${input.userId}`);
  revalidatePath(`/admin/clients/${input.userId}/data`);
  return { ok: true };
}

/**
 * Staff manual notification — "your program is ready" etc. Inserted for the
 * target user via the staff session (notifications_insert_staff RLS). Staff-gated.
 */
export async function sendNotification(input: {
  userId: string;
  title: string;
  body: string;
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const lang = await getLang();

  const title = input.title.trim();
  if (!title) return { ok: false, error: t(lang, "err.notifTitle") };

  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    type: "manual",
    title,
    body: input.body.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${input.userId}`);
  return { ok: true };
}
