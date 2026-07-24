import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FoodLibrary,
  Meal,
  MealItem,
  NutritionPlan,
  NutritionPlanWithMeals,
} from "@/lib/types";

const MEAL_COLS = "id, plan_id, title, order_index, created_at";
const ITEM_COLS = "id, meal_id, name, library_id, portion, note, order_index";

/** The whole food library for the staff UI + combobox, sorted by name. */
export async function loadFoodLibrary(
  supabase: SupabaseClient,
): Promise<FoodLibrary[]> {
  const { data } = await supabase
    .from("food_library")
    .select("id, name, default_portion, note, created_at")
    .order("name", { ascending: true })
    .returns<FoodLibrary[]>();
  return data ?? [];
}

/**
 * Load a single user's nutrition plan with meals + items, ordered. Works for
 * both staff (editing anyone's plan via *_staff_all) and a client reading their
 * own (RLS scopes it to plan.client_id = auth.uid()). Returns null if the user
 * has no plan yet.
 */
export async function loadNutritionPlan(
  supabase: SupabaseClient,
  clientId: string,
): Promise<NutritionPlanWithMeals | null> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, client_id, notes, updated_at, created_at")
    .eq("client_id", clientId)
    .maybeSingle<NutritionPlan>();
  if (!plan) return null;

  const { data: meals } = await supabase
    .from("meals")
    .select(MEAL_COLS)
    .eq("plan_id", plan.id)
    .order("order_index", { ascending: true })
    .returns<Meal[]>();

  const mealList = meals ?? [];
  const mealIds = mealList.map((m) => m.id);

  // Scope items to THIS plan's meals (staff read every user's items via RLS, so
  // an unscoped read would over-fetch; a client only ever sees their own).
  const { data: items } = mealIds.length
    ? await supabase
        .from("meal_items")
        .select(ITEM_COLS)
        .in("meal_id", mealIds)
        .order("order_index", { ascending: true })
        .returns<MealItem[]>()
    : { data: [] as MealItem[] };

  const byMeal = new Map<string, MealItem[]>();
  for (const it of items ?? []) {
    const arr = byMeal.get(it.meal_id) ?? [];
    arr.push(it);
    byMeal.set(it.meal_id, arr);
  }

  return {
    ...plan,
    meals: mealList.map((m) => ({ ...m, items: byMeal.get(m.id) ?? [] })),
  };
}

/** Does this user have a nutrition plan, and how many meals? (dashboard card). */
export async function nutritionPlanSummary(
  supabase: SupabaseClient,
  clientId: string,
): Promise<{ hasPlan: boolean; mealCount: number }> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle<{ id: string }>();
  if (!plan) return { hasPlan: false, mealCount: 0 };

  const { count } = await supabase
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", plan.id);

  return { hasPlan: true, mealCount: count ?? 0 };
}
