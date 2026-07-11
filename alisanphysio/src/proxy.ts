import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy` (Node.js
 * runtime). It must live at the SAME LEVEL as the `app` directory — since this
 * project uses `src/app`, the file belongs at `src/proxy.ts` (a `proxy.ts` at
 * the project root is silently ignored). Runs on every matched request to keep
 * the Supabase session fresh and guard routes (admin area + membership gate).
 */
export async function proxy(request: NextRequest) {
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
