"use server";

import { isAssessmentStatus } from "@/lib/assessment";
import { requireAdmin } from "@/lib/admin-auth";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

type UpdateResult = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateAssessmentStatus(input: {
  id: unknown;
  status: unknown;
}): Promise<UpdateResult> {
  const [{ supabase }, lang] = await Promise.all([requireAdmin(), getLang()]);
  const errorMessage = t(lang, "requests.saveError");
  if (
    typeof input.id !== "string" ||
    !UUID_RE.test(input.id) ||
    !isAssessmentStatus(input.status)
  ) {
    return { ok: false, error: errorMessage };
  }

  const { data, error } = await supabase
    .from("assessment_requests")
    .update({
      status: input.status,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: errorMessage };
  return { ok: true };
}

export async function saveAssessmentAdminNote(input: {
  id: unknown;
  note: unknown;
}): Promise<UpdateResult> {
  const [{ supabase }, lang] = await Promise.all([requireAdmin(), getLang()]);
  const errorMessage = t(lang, "requests.saveError");
  if (
    typeof input.id !== "string" ||
    !UUID_RE.test(input.id) ||
    typeof input.note !== "string" ||
    input.note.length > 5_000
  ) {
    return { ok: false, error: errorMessage };
  }

  const { data, error } = await supabase
    .from("assessment_requests")
    .update({ admin_note: input.note.trim() || null })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: errorMessage };
  return { ok: true };
}
