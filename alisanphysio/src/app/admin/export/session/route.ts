import { requireStaff } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * A cheap staff-session probe for the "Save as PDF" menu. Saved exports
 * download by navigating (they must start inside the tap on iPad), so the
 * button can't inspect that response; it calls this when the menu opens
 * instead. 204 = still signed in as staff. An expired session is redirected
 * to /login by the proxy (or by requireStaff), which the button reads as
 * "expired" and answers with its red error toast instead of navigating.
 */
export async function GET() {
  await requireStaff();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
