"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import {
  isValidTimeZone,
  resolveZonedDateTime,
} from "@/lib/scheduling";
import { createClient } from "@/lib/supabase/server";

type FailureCode =
  | "invalid"
  | "slot_taken"
  | "timezone_required"
  | "wrong_mode";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string; code?: FailureCode };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_PROPOSALS = 8;
const MAX_NOTE_LENGTH = 2_000;
const MAX_CANCEL_REASON_LENGTH = 1_000;

async function requireUser(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

async function currentMode(
  supabase: SupabaseClient,
): Promise<"coach_slots" | "client_proposal" | null> {
  const { data } = await supabase
    .from("coach_settings")
    .select("scheduling_mode")
    .limit(1)
    .maybeSingle<{ scheduling_mode: "coach_slots" | "client_proposal" }>();
  return data?.scheduling_mode ?? null;
}

function slotWasTaken(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const detail = `${error.code ?? ""} ${error.message ?? ""} ${
    error.details ?? ""
  }`.toLowerCase();
  return (
    detail.includes("slot_just_taken") ||
    detail.includes("slot just taken") ||
    detail.includes("slot is no longer open") ||
    detail.includes("availability_slot_unavailable") ||
    detail.includes("appointments_one_live_per_slot") ||
    detail.includes("23505")
  );
}

function errorContains(
  error: { code?: string; message?: string; details?: string },
  value: string,
): boolean {
  return `${error.code ?? ""} ${error.message ?? ""} ${
    error.details ?? ""
  }`
    .toLowerCase()
    .includes(value);
}

/** Atomically book one published slot through the migration's locking RPC. */
export async function bookSlot(input: {
  slotId: unknown;
} | null): Promise<ActionResult> {
  const [{ supabase }, lang] = await Promise.all([requireUser(), getLang()]);
  const slotId = input?.slotId;
  if (typeof slotId !== "string" || !UUID_RE.test(slotId)) {
    return {
      ok: false,
      error: t(lang, "err.scheduleInvalid"),
      code: "invalid",
    };
  }
  if ((await currentMode(supabase)) !== "coach_slots") {
    return {
      ok: false,
      error: t(lang, "err.scheduleWrongMode"),
      code: "wrong_mode",
    };
  }

  const { error } = await supabase.rpc("book_availability_slot", {
    p_slot_id: slotId,
  });
  if (error) {
    if (errorContains(error, "scheduling_mode_not_coach_slots")) {
      return {
        ok: false,
        error: t(lang, "err.scheduleWrongMode"),
        code: "wrong_mode",
      };
    }
    if (slotWasTaken(error)) {
      return {
        ok: false,
        error: t(lang, "err.scheduleSlotTaken"),
        code: "slot_taken",
      };
    }
    return { ok: false, error: t(lang, "err.scheduleSave") };
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard");
  revalidatePath("/admin/availability");
  return { ok: true };
}

export interface ProposalInput {
  date: string;
  time: string;
}

/** Insert one or more client-local candidate times in one atomic statement. */
export async function submitProposals(input: {
  proposals: ProposalInput[];
  note: string;
} | null): Promise<ActionResult<{ count: number }>> {
  const [{ supabase, userId }, lang] = await Promise.all([
    requireUser(),
    getLang(),
  ]);
  if (
    !input ||
    !Array.isArray(input.proposals) ||
    input.proposals.length < 1 ||
    input.proposals.length > MAX_PROPOSALS ||
    typeof input.note !== "string" ||
    input.note.length > MAX_NOTE_LENGTH
  ) {
    return {
      ok: false,
      error: t(lang, "err.scheduleInvalid"),
      code: "invalid",
    };
  }
  if ((await currentMode(supabase)) !== "client_proposal") {
    return {
      ok: false,
      error: t(lang, "err.scheduleWrongMode"),
      code: "wrong_mode",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string | null }>();
  const timeZone = profile?.timezone?.trim() ?? "";
  if (!isValidTimeZone(timeZone)) {
    return {
      ok: false,
      error: t(lang, "err.scheduleTimezoneRequired"),
      code: "timezone_required",
    };
  }

  const starts = new Set<string>();
  for (const proposal of input.proposals) {
    if (
      !proposal ||
      typeof proposal.date !== "string" ||
      typeof proposal.time !== "string" ||
      !DATE_RE.test(proposal.date) ||
      !TIME_RE.test(proposal.time)
    ) {
      return {
        ok: false,
        error: t(lang, "err.scheduleInvalidTime"),
        code: "invalid",
      };
    }
    const resolved = resolveZonedDateTime(
      { date: proposal.date, time: proposal.time },
      timeZone,
      "reject",
    );
    if (!resolved.ok) {
      const key =
        resolved.reason === "ambiguous_local_time"
          ? "err.scheduleAmbiguousTime"
          : resolved.reason === "nonexistent_local_time"
            ? "err.scheduleNonexistentTime"
            : "err.scheduleInvalidTime";
      return { ok: false, error: t(lang, key), code: "invalid" };
    }
    if (Date.parse(resolved.startsAt) <= Date.now()) {
      return {
        ok: false,
        error: t(lang, "err.schedulePastTime"),
        code: "invalid",
      };
    }
    starts.add(resolved.startsAt);
  }
  if (starts.size !== input.proposals.length) {
    return {
      ok: false,
      error: t(lang, "err.scheduleDuplicateTime"),
      code: "invalid",
    };
  }

  const note = input.note.trim() || null;
  const proposalGroupId = crypto.randomUUID();
  const { error } = await supabase.from("client_proposals").insert(
    [...starts].map((proposed_start) => ({
      client_id: userId,
      proposal_group_id: proposalGroupId,
      proposed_start,
      note,
      status: "pending",
    })),
  );
  if (error) {
    if (errorContains(error, "scheduling_mode_not_client_proposal")) {
      return {
        ok: false,
        error: t(lang, "err.scheduleWrongMode"),
        code: "wrong_mode",
      };
    }
    if (errorContains(error, "proposal_must_be_in_the_future")) {
      return {
        ok: false,
        error: t(lang, "err.schedulePastTime"),
        code: "invalid",
      };
    }
    return { ok: false, error: t(lang, "err.scheduleSave") };
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/admin/availability");
  return { ok: true, count: starts.size };
}

/** Cancel one own appointment through the transactional cancellation RPC. */
export async function cancelOwnAppointment(input: {
  appointmentId: unknown;
  reason: unknown;
} | null): Promise<ActionResult> {
  const [{ supabase }, lang] = await Promise.all([requireUser(), getLang()]);
  if (
    !input ||
    typeof input.appointmentId !== "string" ||
    !UUID_RE.test(input.appointmentId) ||
    typeof input.reason !== "string" ||
    input.reason.length > MAX_CANCEL_REASON_LENGTH
  ) {
    return {
      ok: false,
      error: t(lang, "err.scheduleInvalid"),
      code: "invalid",
    };
  }

  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: input.appointmentId,
    p_reason: input.reason.trim() || null,
  });
  if (error) {
    return { ok: false, error: t(lang, "err.scheduleCancel") };
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard");
  revalidatePath("/admin/availability");
  return { ok: true };
}
