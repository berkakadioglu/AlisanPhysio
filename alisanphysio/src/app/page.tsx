import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * No landing page — resolve where the user belongs by role.
 * Admins go to /admin, clients to /dashboard. The proxy sends signed-out
 * visitors to /login before they ever reach here.
 */
export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
}
