"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeYouTubeUrl } from "@/lib/youtube";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

type Result = { ok: true } | { ok: false; error: string };

function validate(
  input: { name: string; youtubeUrl: string; defaultInstructions: string },
  lang: Lang,
): { name: string; youtube_url: string | null; default_instructions: string | null } | string {
  const name = input.name.trim();
  if (!name) return t(lang, "err.giveExerciseName");

  const rawUrl = input.youtubeUrl.trim();
  let youtube_url: string | null = null;
  if (rawUrl) {
    const normalized = normalizeYouTubeUrl(rawUrl);
    if (!normalized) return t(lang, "err.notYouTube");
    youtube_url = normalized;
  }

  return {
    name,
    youtube_url,
    default_instructions: input.defaultInstructions.trim() || null,
  };
}

export async function createLibraryExercise(input: {
  name: string;
  youtubeUrl: string;
  defaultInstructions: string;
}): Promise<Result> {
  const { supabase } = await requireAdmin();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const { error } = await supabase.from("exercise_library").insert(parsed);
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, error: t(lang, "err.exerciseExists") };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/library");
  return { ok: true };
}

export async function updateLibraryExercise(input: {
  id: string;
  name: string;
  youtubeUrl: string;
  defaultInstructions: string;
}): Promise<Result> {
  const { supabase } = await requireAdmin();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const { error } = await supabase
    .from("exercise_library")
    .update(parsed)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/library");
  return { ok: true };
}

export async function deleteLibraryExercise(input: {
  id: string;
}): Promise<Result> {
  const { supabase } = await requireAdmin();
  // exercises.library_id is ON DELETE SET NULL, so past programs keep their name.
  const { error } = await supabase
    .from("exercise_library")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/library");
  return { ok: true };
}
