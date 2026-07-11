import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminContext {
  supabase: SupabaseClient;
  userId: string;
  profile: Profile;
}

/**
 * Server-side admin gate. Every /admin page and every admin server action calls
 * this FIRST — never trust the proxy or the client alone. Redirects non-admins
 * away before any privileged work happens.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return { supabase, userId: user.id, profile };
}
