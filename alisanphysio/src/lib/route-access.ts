export type AccessRole = "admin" | "manager" | "client" | null;

export type RouteAccessInput = {
  pathname: string;
  authenticated: boolean;
  role: AccessRole;
  membershipIsActive: boolean;
  publicPaths: readonly string[];
};

export function portalPathForRole(
  role: unknown,
  authenticated: boolean,
): "/login" | "/dashboard" | "/admin" {
  if (!authenticated) return "/login";
  return role === "admin" || role === "manager" ? "/admin" : "/dashboard";
}

export function isPublicPath(
  pathname: string,
  publicPaths: readonly string[],
): boolean {
  return publicPaths.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
}

/**
 * Pure redirect decision used by the live proxy and by decision-trace tests.
 * Returning null means the request continues unchanged.
 */
export function routeRedirect({
  pathname,
  authenticated,
  role,
  membershipIsActive,
  publicPaths,
}: RouteAccessInput): string | null {
  const isPublic = isPublicPath(pathname, publicPaths);

  if (!authenticated) {
    return isPublic ? null : "/login";
  }

  const isStaff = role === "admin" || role === "manager";

  if (pathname === "/login") {
    return portalPathForRole(role, true);
  }

  if (pathname.startsWith("/admin") && !isStaff) {
    return "/dashboard";
  }

  if (pathname === "/membership-inactive") {
    if (role === "client") {
      return membershipIsActive ? "/dashboard" : null;
    }
    return "/";
  }

  // Public marketing routes remain public for every signed-in state, including
  // clients whose membership is inactive.
  if (isPublic) return null;

  if (role === "client" && !membershipIsActive) {
    return "/membership-inactive";
  }

  return null;
}
