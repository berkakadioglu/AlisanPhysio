"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

type Result = { ok: true } | { ok: false; error: string };

function validate(
  input: { name: string; defaultPortion: string; note: string },
  lang: Lang,
): { name: string; default_portion: string | null; note: string | null } | string {
  const name = input.name.trim();
  if (!name) return t(lang, "err.giveFoodName");
  return {
    name,
    default_portion: input.defaultPortion.trim() || null,
    note: input.note.trim() || null,
  };
}

export async function createFood(input: {
  name: string;
  defaultPortion: string;
  note: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  // Avoid confusing near-duplicates (case-insensitive).
  const { data: existing } = await supabase
    .from("food_library")
    .select("id")
    .ilike("name", parsed.name)
    .maybeSingle();
  if (existing) return { ok: false, error: t(lang, "err.foodExists") };

  const { error } = await supabase.from("food_library").insert(parsed);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/food-library");
  return { ok: true };
}

export async function updateFood(input: {
  id: string;
  name: string;
  defaultPortion: string;
  note: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const lang = await getLang();
  const parsed = validate(input, lang);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const { error } = await supabase
    .from("food_library")
    .update(parsed)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/food-library");
  return { ok: true };
}

export async function deleteFood(input: { id: string }): Promise<Result> {
  const { supabase } = await requireStaff();
  // meal_items.library_id is ON DELETE SET NULL, so plans keep the food's name.
  const { error } = await supabase
    .from("food_library")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/food-library");
  return { ok: true };
}
