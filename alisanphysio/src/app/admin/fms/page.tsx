import { requireStaff } from "@/lib/admin-auth";
import { getLang } from "@/lib/i18n-server";
import { FMS_SETTINGS_COLUMNS } from "@/lib/fms-data";
import { FMS_STATUSES, type FmsBooking, type FmsSettings, type FmsStatus } from "@/lib/fms";
import AdminHeader from "@/app/admin/admin-header";
import FmsManager from "./fms-manager";
export default async function FmsAdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ supabase }, lang, query] = await Promise.all([requireStaff(), getLang(), searchParams]);
  const status = FMS_STATUSES.includes(query.status as FmsStatus) ? query.status as FmsStatus : "all";
  let bookingsQuery = supabase.from("fms_bookings").select("id, created_at, full_name, email, starts_at, duration_min, visitor_timezone, preferred_language, status, admin_note").order("starts_at");
  if (status !== "all") bookingsQuery = bookingsQuery.eq("status", status);
  async function loadBookings() {
    const rows: FmsBooking[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bookingsQuery.range(offset, offset + 999).returns<FmsBooking[]>();
      if (error) throw new Error("FMS bookings unavailable");
      rows.push(...data ?? []);
      if (!data || data.length < 1000) return rows;
    }
  }
  const [bookings, settings] = await Promise.all([
    loadBookings(),
    supabase.from("coach_settings").select(FMS_SETTINGS_COLUMNS).eq("singleton", true).single<FmsSettings>(),
  ]);
  if (settings.error || !settings.data) throw new Error("FMS data unavailable");
  const now = new Date().getTime();
  const sorted = [...bookings].sort((a, b) => {
    const at = Date.parse(a.starts_at), bt = Date.parse(b.starts_at);
    if ((at >= now) !== (bt >= now)) return at >= now ? -1 : 1;
    return at >= now ? at - bt : bt - at;
  });
  return <div className="min-h-screen"><AdminHeader container="max-w-6xl" /><main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <FmsManager key={status} lang={lang} bookings={sorted} settings={settings.data} status={status} />
  </main></div>;
}
