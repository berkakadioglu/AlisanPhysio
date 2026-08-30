import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminContext {
  supabase: SupabaseClient;
  userId: string;
  profile: Pick<Profile, "id" | "full_name" | "role" | "created_at" | "timezone">;
}

/**
 * Server-side gate shared by the admin area. Loads the caller's profile and
 * redirects anyone whose role isn't in `allowed` BEFORE any privileged work.
 * Never trust the proxy or the client alone — pages and actions call this too.
 */
async function requireRole(allowed: Role[]): Promise<AdminContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, timezone")
    .eq("id", user.id)
    .single<AdminContext["profile"]>();

  if (!profile || !allowed.includes(profile.role)) {
    redirect("/dashboard");
  }

  return { supabase, userId: user.id, profile };
}

/**
 * Staff gate (admin OR manager). Use for shared admin-area work: managing
 * clients, authoring programs, editing the library. Both roles reach /admin.
 */
export function requireStaff(): Promise<AdminContext> {
  return requireRole(["admin", "manager"]);
}

/**
 * Admin-only gate. Use for the privileged operations a manager must NOT do:
 * assigning/changing roles and deleting users.
 */
export function requireAdmin(): Promise<AdminContext> {
  return requireRole(["admin"]);
}
