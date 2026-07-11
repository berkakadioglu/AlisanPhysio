import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS } from "@/lib/constants";
import { membershipActive, todayISO } from "@/lib/membership";

/** The blocked screen shown to a client without an active membership. */
const INACTIVE_PATH = "/membership-inactive";

/**
 * Refreshes the Supabase auth session on every matched request and guards
 * protected routes. Called from the root `proxy.ts` (Next.js 16 renamed the
 * `middleware` convention to `proxy`).
 *
 * Two gates, both re-checked server-side in the relevant pages/actions:
 *   1. Admin area (/admin) — only role='admin'.
 *   2. Membership — a role='client' with no active membership is sent to the
 *      blocked screen. This gate applies to CLIENTS ONLY; admins (and any
 *      non-client role) are NEVER gated by membership.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run code between createServerClient and getUser().
  // getUser() revalidates the token and refreshes cookies when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  };

  // Not signed in and trying to reach a protected route → send to /login.
  if (!user && !isPublic) {
    return redirectTo("/login");
  }

  // Signed in but sitting on /login → let the root route them by role.
  if (user && pathname === "/login") {
    return redirectTo("/");
  }

  if (user) {
    // One read of the caller's own row (RLS lets a user read their own profile).
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, membership, membership_end_date")
      .eq("id", user.id)
      .single<{
        role: string | null;
        membership: string | null;
        membership_end_date: string | null;
      }>();

    const role = profile?.role;

    // Admin area: only role='admin' may enter. UX redirect; every /admin page
    // and action ALSO re-checks server-side (defense in depth).
    if (pathname.startsWith("/admin") && role !== "admin") {
      return redirectTo("/dashboard");
    }

    // Membership gate — CLIENTS ONLY. Admins (and any non-client) are never
    // gated: Alişan must always reach /admin regardless of membership fields.
    if (role === "client") {
      const active = membershipActive(
        profile?.membership,
        profile?.membership_end_date,
        todayISO(),
      );
      const onBlockedScreen = pathname === INACTIVE_PATH;
      if (!active && !onBlockedScreen) {
        return redirectTo(INACTIVE_PATH);
      }
      // Access restored while stuck on the blocked screen → let them back in.
      if (active && onBlockedScreen) {
        return redirectTo("/dashboard");
      }
    } else if (pathname === INACTIVE_PATH) {
      // Admins/others never see the blocked screen; route them home.
      return redirectTo("/");
    }
  }

  return supabaseResponse;
}
