"use server";
import { requireStaff } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
export async function setNutritionEnabled(clientId: string, enabled: boolean): Promise<boolean> {
  const { supabase } = await requireStaff();
  if (typeof enabled !== "boolean" || !/^[0-9a-f-]{36}$/i.test(clientId)) return false;
  const { data, error } = await supabase.from("profiles").update({ nutrition_enabled: enabled }).eq("id", clientId).select("id").maybeSingle();
  if (error || !data) return false;
  revalidatePath(`/admin/clients/${clientId}`); revalidatePath(`/admin/clients/${clientId}/nutrition`);
  revalidatePath("/dashboard", "layout"); return true;
}
