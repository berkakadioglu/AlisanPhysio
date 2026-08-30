import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS } from "@/lib/constants";
import { membershipActive, todayISO } from "@/lib/membership";
import { routeRedirect } from "@/lib/route-access";
import { DEMO_REQUEST_HEADER } from "@/lib/demo-route";

/**
 * Refreshes the Supabase auth session on every matched request and guards
 * protected routes. Called from the root `proxy.ts` (Next.js 16 renamed the
 * `middleware` convention to `proxy`).
 *
 * Two route gates:
 *   1. Admin area (/admin) — staff roles only; pages/actions also re-check.
 *   2. Membership — a role='client' with no active membership is sent to the
 *      blocked screen. This proxy is its enforcement point. Staff and public
 *      marketing routes are never gated by membership.
 */
export async function updateSession(request: NextRequest) {
  const responseForApp = () => {
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set(DEMO_REQUEST_HEADER, "0");
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  };
  let supabaseResponse = responseForApp();

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
          supabaseResponse = responseForApp();
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

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  };

  let role: string | null = null;
  let activeMembership = false;
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

    role = profile?.role ?? null;
    if (role === "client") {
      activeMembership = membershipActive(
        profile?.membership,
        profile?.membership_end_date,
        todayISO(),
      );
    }
  }

  const redirectPath = routeRedirect({
    pathname,
    authenticated: Boolean(user),
    role:
      role === "admin" || role === "manager" || role === "client" ? role : null,
    membershipIsActive: activeMembership,
    publicPaths: PUBLIC_PATHS,
  });

  if (redirectPath) return redirectTo(redirectPath);

  return supabaseResponse;
}
