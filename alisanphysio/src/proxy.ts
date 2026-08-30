import { type NextRequest, NextResponse } from "next/server";
import {
  DEMO_REQUEST_HEADER,
  isDemoRequestPath,
} from "@/lib/demo-route";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy` (Node.js
 * runtime). It must live at the SAME LEVEL as the `app` directory — since this
 * project uses `src/app`, the file belongs at `src/proxy.ts` (a `proxy.ts` at
 * the project root is silently ignored). Runs on every matched request to keep
 * the Supabase session fresh and guard routes (admin area + membership gate).
 */
export async function proxy(request: NextRequest) {
  const isReadRequest = request.method === "GET" || request.method === "HEAD";
  const isDemo =
    isReadRequest && isDemoRequestPath(request.nextUrl.pathname);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(DEMO_REQUEST_HEADER, isDemo ? "1" : "0");

  if (isDemo) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  const { updateSession } = await import("@/lib/supabase/middleware");
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and other static image assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
