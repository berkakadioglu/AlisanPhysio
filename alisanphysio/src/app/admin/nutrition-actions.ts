"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";

interface MealItemInput {
  name: string;
  portion: string | null;
  note: string | null;
  library_id: string | null;
  /** Custom food the admin wants to persist to the food library for reuse. */
  saveToLibrary?: boolean;
}

interface MealInput {
  title: string;
  items: MealItemInput[];
}

interface SaveNutritionInput {
  clientId: string;
  notes: string;
  meals: MealInput[];
}

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

/**
 * Upsert the single nutrition plan for a client (one plan per user, enforced by
 * the UNIQUE client_id) plus its meals and items. Uses the staff session (RLS
 * *_staff_all authorizes it). Meals + items are replaced wholesale, which
 * cleanly handles add/remove/reorder at both levels. Mirrors saveProgram.
 */
export async function saveNutritionPlan(
  input: SaveNutritionInput,
): Promise<Result<{ planId: string }>> {
  const { supabase } = await requireStaff();

  // Keep meals that have a title or at least one named item.
  const meals = input.meals
    .map((m) => ({
      title: m.title.trim(),
      items: m.items.filter((it) => it.name.trim() !== ""),
    }))
    .filter((m) => m.title !== "" || m.items.length > 0);

  const notes = input.notes.trim() || null;

  // Resolve the existing plan (one per client) or create it.
  const { data: existingPlan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", input.clientId)
    .maybeSingle<{ id: string }>();

  let planId = existingPlan?.id;

  if (planId) {
    const { error } = await supabase
      .from("nutrition_plans")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", planId);
    if (error) return { ok: false, error: error.message };

    // Replace items then meals (items reference meals).
    const { data: mealRows } = await supabase
      .from("meals")
      .select("id")
      .eq("plan_id", planId)
      .returns<{ id: string }[]>();
    const mealIds = (mealRows ?? []).map((m) => m.id);
    if (mealIds.length > 0) {
      const { error: itemDelErr } = await supabase
        .from("meal_items")
        .delete()
        .in("meal_id", mealIds);
      if (itemDelErr) return { ok: false, error: itemDelErr.message };
    }
    const { error: mealDelErr } = await supabase
      .from("meals")
      .delete()
      .eq("plan_id", planId);
    if (mealDelErr) return { ok: false, error: mealDelErr.message };
  } else {
    const { data, error } = await supabase
      .from("nutrition_plans")
      .insert({ client_id: input.clientId, notes })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not create plan." };
    }
    planId = data.id as string;
  }

  // Insert meals, then their items (with the new meal_id + ordering).
  const itemRows: Array<Record<string, unknown>> = [];

  for (let mi = 0; mi < meals.length; mi++) {
    const meal = meals[mi];
    const { data: mealRow, error: mealErr } = await supabase
      .from("meals")
      .insert({
        plan_id: planId,
        title: meal.title || "Meal",
        order_index: mi,
      })
      .select("id")
      .single();
    if (mealErr || !mealRow) {
      return { ok: false, error: mealErr?.message ?? "Could not save a meal." };
    }
    const mealId = mealRow.id as string;

    for (let ii = 0; ii < meal.items.length; ii++) {
      const it = meal.items[ii];
      const name = it.name.trim();
      let libraryId = it.library_id;

      // "Save to library" for a custom food → resolve/create the entry.
      if (!libraryId && it.saveToLibrary) {
        const { data: existing } = await supabase
          .from("food_library")
          .select("id")
          .ilike("name", name)
          .maybeSingle();
        if (existing) {
          libraryId = existing.id as string;
        } else {
          const { data: created } = await supabase
            .from("food_library")
            .insert({ name, default_portion: it.portion?.trim() || null })
            .select("id")
            .single();
          if (created) libraryId = created.id as string;
        }
      }

      itemRows.push({
        meal_id: mealId,
        name,
        portion: it.portion?.trim() || null,
        note: it.note?.trim() || null,
        library_id: libraryId ?? null,
        order_index: ii,
      });
    }
  }

  if (itemRows.length > 0) {
    const { error } = await supabase.from("meal_items").insert(itemRows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath(`/admin/clients/${input.clientId}/nutrition`);
  return { ok: true, planId: planId! };
}

/** Delete a client's nutrition plan (meals + items cascade). */
export async function deleteNutritionPlan(input: {
  clientId: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();

  const { error } = await supabase
    .from("nutrition_plans")
    .delete()
    .eq("client_id", input.clientId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath(`/admin/clients/${input.clientId}/nutrition`);
  return { ok: true };
}
