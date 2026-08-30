"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import {
  generateWeeklyOccurrences,
  isValidMeetingUrl,
  isValidTimeZone,
  resolveZonedDateTime,
} from "@/lib/scheduling";
import type { SchedulingMode } from "@/lib/types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function schedulingPaths() {
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard");
}

function compact(value: string | null | undefined, max: number): string | null {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, max) : null;
}

function validDuration(value: number): boolean {
  return Number.isInteger(value) && value >= 5 && value <= 480;
}

async function localizedError(message: string): Promise<string> {
  const lang = await getLang();
  if (message.includes("slot_just_taken")) return t(lang, "schedule.err.slotTaken");
  if (message.includes("scheduling_mode_not_coach_slots")) {
    return t(lang, "err.scheduleWrongMode");
  }
  if (message.includes("proposal_already_decided")) {
    return t(lang, "schedule.err.proposalDecided");
  }
  if (message.includes("proposal_is_in_the_past")) {
    return t(lang, "schedule.err.pastTime");
  }
  return t(lang, "schedule.err.saveFailed");
}

export async function updateSchedulingSettings(input: {
  mode: SchedulingMode;
  durationMin: number;
  timezone: string;
}): Promise<ActionResult> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (
    !(["coach_slots", "client_proposal"] as const).includes(input.mode) ||
    !validDuration(input.durationMin) ||
    !isValidTimeZone(input.timezone)
  ) {
    return { ok: false, error: t(lang, "schedule.err.settingsInvalid") };
  }

  const { error } = await supabase
    .from("coach_settings")
    .update({
      scheduling_mode: input.mode,
      default_duration_min: input.durationMin,
      timezone: input.timezone,
    })
    .eq("singleton", true);
  if (error) return { ok: false, error: await localizedError(error.message) };

  schedulingPaths();
  return { ok: true };
}

export type AvailabilityPatternInput = {
  localTime: string;
  durationMin: number;
  note: string;
};

export async function publishAvailability(input: {
  firstDate: string;
  timezone: string;
  weeks: number;
  patterns: AvailabilityPatternInput[];
}): Promise<ActionResult<{ count: number }>> {
  const [{ supabase, userId }, lang] = await Promise.all([
    requireStaff(),
    getLang(),
  ]);
  if (
    !DATE_RE.test(input.firstDate) ||
    !isValidTimeZone(input.timezone) ||
    !Number.isInteger(input.weeks) ||
    input.weeks < 1 ||
    input.weeks > 52 ||
    input.patterns.length < 1 ||
    input.patterns.length > 12 ||
    input.patterns.some(
      (pattern) =>
        !TIME_RE.test(pattern.localTime) || !validDuration(pattern.durationMin),
    )
  ) {
    return { ok: false, error: t(lang, "schedule.err.slotInvalid") };
  }

  // Treat the saved setting as authoritative. This also closes a stale-tab
  // race where another staff session switched to proposal mode after render.
  const { data: currentSettings, error: settingsError } = await supabase
    .from("coach_settings")
    .select("scheduling_mode")
    .eq("singleton", true)
    .maybeSingle<{ scheduling_mode: SchedulingMode }>();
  if (settingsError) {
    return { ok: false, error: await localizedError(settingsError.message) };
  }
  if (currentSettings?.scheduling_mode !== "coach_slots") {
    return {
      ok: false,
      error: await localizedError("scheduling_mode_not_coach_slots"),
    };
  }

  let occurrences;
  try {
    occurrences = input.patterns.flatMap((pattern) =>
      generateWeeklyOccurrences({
        firstDate: input.firstDate,
        localTime: pattern.localTime,
        timeZone: input.timezone,
        weeks: input.weeks,
        durationMin: pattern.durationMin,
        disambiguation: "reject",
      }).map((occurrence) => ({
        created_by: userId,
        starts_at: occurrence.startsAt,
        duration_min: occurrence.durationMin,
        status: "open",
        note: compact(pattern.note, 1000),
      })),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    return {
      ok: false,
      error: t(
        lang,
        reason.includes("ambiguous_local_time")
          ? "schedule.err.dstAmbiguous"
          : reason.includes("nonexistent_local_time")
            ? "schedule.err.dstGap"
            : "schedule.err.slotInvalid",
      ),
    };
  }

  if (occurrences.some((row) => Date.parse(row.starts_at) <= Date.now())) {
    return { ok: false, error: t(lang, "schedule.err.pastTime") };
  }

  const unique = new Map(
    occurrences.map((row) => [
      `${row.starts_at}:${row.duration_min}`,
      row,
    ]),
  );
  const rows = [...unique.values()];
  const { error } = await supabase.from("availability_slots").insert(rows);
  if (error) return { ok: false, error: await localizedError(error.message) };

  schedulingPaths();
  return { ok: true, count: rows.length };
}

export async function setAvailabilitySlotState(input: {
  slotId: string;
  status: "open" | "closed";
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!UUID_RE.test(input.slotId)) {
    return { ok: false, error: await localizedError("invalid_slot") };
  }
  const { data, error } = await supabase
    .from("availability_slots")
    .update({ status: input.status })
    .eq("id", input.slotId)
    .in("status", ["open", "closed"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: await localizedError(error?.message ?? "slot_changed") };
  }
  schedulingPaths();
  return { ok: true };
}

export async function confirmAppointment(input: {
  appointmentId: string;
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!UUID_RE.test(input.appointmentId)) {
    return { ok: false, error: await localizedError("invalid_appointment") };
  }
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", input.appointmentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: await localizedError(error?.message ?? "appointment_changed") };
  }
  schedulingPaths();
  return { ok: true };
}

export async function acceptProposal(input: {
  proposalId: string;
  durationMin: number;
  agenda: string;
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!UUID_RE.test(input.proposalId) || !validDuration(input.durationMin)) {
    return { ok: false, error: await localizedError("invalid_proposal") };
  }
  const { error } = await supabase.rpc("accept_client_proposal", {
    p_proposal_id: input.proposalId,
    p_duration_min: input.durationMin,
    p_agenda: compact(input.agenda, 2000),
  });
  if (error) return { ok: false, error: await localizedError(error.message) };
  schedulingPaths();
  return { ok: true };
}

export async function declineProposal(input: {
  proposalId: string;
  reason: string;
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!UUID_RE.test(input.proposalId)) {
    return { ok: false, error: await localizedError("invalid_proposal") };
  }
  const { error } = await supabase.rpc("decline_client_proposal", {
    p_proposal_id: input.proposalId,
    p_reason: compact(input.reason, 1000),
  });
  if (error) return { ok: false, error: await localizedError(error.message) };
  schedulingPaths();
  return { ok: true };
}

export async function createDirectAppointment(input: {
  clientId: string;
  localDate: string;
  localTime: string;
  timezone: string;
  durationMin: number;
  agenda: string;
  coachNote: string;
  meetingUrl: string;
}): Promise<ActionResult> {
  const [{ supabase, userId }, lang] = await Promise.all([
    requireStaff(),
    getLang(),
  ]);
  if (
    !UUID_RE.test(input.clientId) ||
    !DATE_RE.test(input.localDate) ||
    !TIME_RE.test(input.localTime) ||
    !isValidTimeZone(input.timezone) ||
    !validDuration(input.durationMin)
  ) {
    return { ok: false, error: t(lang, "schedule.err.appointmentInvalid") };
  }
  const meetingUrl = compact(input.meetingUrl, 2000);
  if (meetingUrl && !isValidMeetingUrl(meetingUrl)) {
    return { ok: false, error: t(lang, "schedule.err.meetingUrl") };
  }
  const resolved = resolveZonedDateTime(
    { date: input.localDate, time: input.localTime },
    input.timezone,
    "reject",
  );
  if (!resolved.ok) {
    return {
      ok: false,
      error: t(
        lang,
        resolved.reason === "ambiguous_local_time"
          ? "schedule.err.dstAmbiguous"
          : resolved.reason === "nonexistent_local_time"
            ? "schedule.err.dstGap"
            : "schedule.err.appointmentInvalid",
      ),
    };
  }
  if (Date.parse(resolved.startsAt) <= Date.now()) {
    return { ok: false, error: t(lang, "schedule.err.pastTime") };
  }

  const { data: client } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", input.clientId)
    .eq("role", "client")
    .maybeSingle();
  if (!client) return { ok: false, error: t(lang, "schedule.err.clientInvalid") };

  const { error } = await supabase.from("appointments").insert({
    client_id: input.clientId,
    coach_id: userId,
    starts_at: resolved.startsAt,
    duration_min: input.durationMin,
    status: "confirmed",
    meeting_url: meetingUrl,
    agenda: compact(input.agenda, 2000),
    coach_note: compact(input.coachNote, 4000),
  });
  if (error) return { ok: false, error: await localizedError(error.message) };
  schedulingPaths();
  return { ok: true };
}

export async function updateAppointmentDetails(input: {
  appointmentId: string;
  agenda: string;
  coachNote: string;
  meetingUrl: string;
}): Promise<ActionResult> {
  const [{ supabase }, lang] = await Promise.all([requireStaff(), getLang()]);
  if (!UUID_RE.test(input.appointmentId)) {
    return { ok: false, error: t(lang, "schedule.err.appointmentInvalid") };
  }
  const meetingUrl = compact(input.meetingUrl, 2000);
  if (meetingUrl && !isValidMeetingUrl(meetingUrl)) {
    return { ok: false, error: t(lang, "schedule.err.meetingUrl") };
  }
  const { error } = await supabase
    .from("appointments")
    .update({
      agenda: compact(input.agenda, 2000),
      coach_note: compact(input.coachNote, 4000),
      meeting_url: meetingUrl,
    })
    .eq("id", input.appointmentId);
  if (error) return { ok: false, error: await localizedError(error.message) };
  schedulingPaths();
  return { ok: true };
}

export async function cancelAppointment(input: {
  appointmentId: string;
  reason: string;
}): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!UUID_RE.test(input.appointmentId)) {
    return { ok: false, error: await localizedError("invalid_appointment") };
  }
  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: input.appointmentId,
    p_reason: compact(input.reason, 1000),
  });
  if (error) return { ok: false, error: await localizedError(error.message) };
  schedulingPaths();
  return { ok: true };
}
