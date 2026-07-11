import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the SERVICE ROLE key. This BYPASSES Row Level Security,
 * so it must ONLY ever be imported in trusted server-side code (Route Handlers
 * / Server Actions) — never in a Client Component.
 *
 * Use it for admin-only operations such as creating client accounts.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
