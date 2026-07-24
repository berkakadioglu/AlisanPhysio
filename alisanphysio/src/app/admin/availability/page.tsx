import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/constants";
import { getLang } from "@/lib/i18n-server";
import { membershipActive, todayISO } from "@/lib/membership";
import { loadWeekRequests } from "@/lib/availability";
import { thisMondayISO } from "@/lib/program-dates";
import AdminHeader from "../admin-header";
import AvailabilityManager, {
  type AvailClient,
  type AvailResponse,
} from "./availability-manager";

export const metadata: Metadata = {
  title: `Availability · ${BRAND_NAME}`,
};

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

type ProfileRow = {
  id: string;
  full_name: string | null;
  membership: string | null;
  membership_end_date: string | null;
};

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase } = await requireStaff();
  const lang = await getLang();

  const { week } = await searchParams;
  const weekStart = week && WEEK_RE.test(week) ? week : thisMondayISO();
  const today = todayISO();

  // All clients + membership → active flag. Staff read every profile via RLS.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, membership, membership_end_date")
    .eq("role", "client")
    .order("full_name", { ascending: true })
    .returns<ProfileRow[]>();

  // Emails live in the auth schema (not RLS-readable) — read server-side purely
  // for display, exactly like the users list does.
  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(userList.users.map((u) => [u.id, u.email ?? ""]));

  const clients: AvailClient[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || null,
    email: emailById.get(p.id) ?? "",
    active: membershipActive(p.membership, p.membership_end_date, today),
  }));
  const nameById = new Map(clients.map((c) => [c.id, c]));

  // This week's requests + submitted slots (staff read all via RLS).
  const requests = await loadWeekRequests(supabase, weekStart);
  const responses: AvailResponse[] = requests
    .map((r) => {
      const c = nameById.get(r.client_id);
      return {
        clientId: r.client_id,
        name: c?.name ?? null,
        email: c?.email ?? "",
        createdAt: r.created_at,
        slots: r.slots.map((s) => ({
          dayDate: s.day_date,
          timeFrom: s.time_from,
          timeTo: s.time_to,
          note: s.note,
        })),
      };
    })
    .sort((a, b) => {
      // Responded first, then alphabetical.
      const ar = a.slots.length > 0 ? 0 : 1;
      const br = b.slots.length > 0 ? 0 : 1;
      if (ar !== br) return ar - br;
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <AvailabilityManager
          lang={lang}
          weekStart={weekStart}
          clients={clients}
          responses={responses}
        />
      </main>
    </div>
  );
}
