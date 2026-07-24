"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { formatWeekRange, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { membershipActive, todayISO } from "@/lib/membership";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Send an availability request for one week to a set of clients. Creates one
 * availability_requests row per client (duplicates for the same week are
 * skipped) AND an idempotent notification per client that links to their
 * availability form. Runs as the staff session (RLS *_staff_all + notifications
 * insert-staff authorize it). Staff-gated.
 *
 * scope 'all' targets every ACTIVE client (a set tier whose end date, if any,
 * isn't past); scope 'selected' targets the passed clientIds.
 */
export async function sendAvailabilityRequests(input: {
  weekStart: string;
  scope: "all" | "selected";
  clientIds?: string[];
}): Promise<ActionResult<{ count: number }>> {
  const { supabase, userId } = await requireStaff();
  const lang = await getLang();

  const weekStart = input.weekStart;
  if (!WEEK_RE.test(weekStart)) {
    return { ok: false, error: t(lang, "err.availWeek") };
  }

  // Resolve the target client ids.
  let clientIds: string[];
  if (input.scope === "all") {
    const today = todayISO();
    const { data: clients } = await supabase
      .from("profiles")
      .select("id, membership, membership_end_date")
      .eq("role", "client")
      .returns<
        { id: string; membership: string | null; membership_end_date: string | null }[]
      >();
    clientIds = (clients ?? [])
      .filter((c) => membershipActive(c.membership, c.membership_end_date, today))
      .map((c) => c.id);
  } else {
    const ids = (input.clientIds ?? []).filter(Boolean);
    if (ids.length === 0) {
      return { ok: false, error: t(lang, "err.availNoClients") };
    }
    // Re-verify these are actually clients before sending.
    const { data: rows } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "client")
      .in("id", ids)
      .returns<{ id: string }[]>();
    clientIds = (rows ?? []).map((r) => r.id);
  }

  if (clientIds.length === 0) {
    return { ok: false, error: t(lang, "err.availNoClients") };
  }

  // Which of the targets were already asked for this week? Those keep their
  // existing request + earlier notification; only the NEW ones get notified,
  // so re-sending the same week never double-notifies anyone.
  const { data: existing } = await supabase
    .from("availability_requests")
    .select("client_id")
    .eq("week_start", weekStart)
    .in("client_id", clientIds)
    .returns<{ client_id: string }[]>();
  const alreadyAsked = new Set((existing ?? []).map((r) => r.client_id));
  const newClientIds = clientIds.filter((id) => !alreadyAsked.has(id));

  // Create the requests (duplicates for the same week are skipped). The
  // availability_requests table has a single FOR ALL staff policy, so upsert is
  // safe here.
  const { error: reqErr } = await supabase.from("availability_requests").upsert(
    clientIds.map((client_id) => ({
      client_id,
      week_start: weekStart,
      created_by: userId,
    })),
    { onConflict: "client_id,week_start", ignoreDuplicates: true },
  );
  if (reqErr) return { ok: false, error: reqErr.message };

  // Notify only the newly-asked clients. A plain insert (not upsert) keeps this
  // within the staff INSERT policy — the notifications table has no staff UPDATE
  // policy, which an upsert's ON CONFLICT path would require.
  if (newClientIds.length > 0) {
    const range = formatWeekRange(weekStart, lang);
    const { error: notifErr } = await supabase.from("notifications").insert(
      newClientIds.map((user_id) => ({
        user_id,
        type: "availability",
        title: t(lang, "notif.availability.title"),
        body: t(lang, "notif.availability.body", { range }),
        link: `/dashboard/availability?week=${weekStart}`,
        dedupe_key: `availability:${weekStart}`,
      })),
    );
    if (notifErr) return { ok: false, error: notifErr.message };
  }

  revalidatePath("/admin/availability");
  return { ok: true, count: clientIds.length };
}
