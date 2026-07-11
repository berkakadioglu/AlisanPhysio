import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/constants";
import { isMembership, type Membership } from "@/lib/membership";
import AdminHeader from "./admin-header";
import AdminClientsView, { type AdminClient } from "./admin-clients-view";

export const metadata: Metadata = {
  title: `Clients · ${BRAND_NAME}`,
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  created_at: string;
  membership: string | null;
  membership_end_date: string | null;
  programs: { count: number }[];
};

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();

  // Clients + their program counts, authorized by the admin's own session (RLS).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, membership, membership_end_date, programs(count)")
    .eq("role", "client")
    .order("created_at", { ascending: true })
    .returns<ProfileRow[]>();

  // Emails live in the auth schema (not RLS-readable), so we read them
  // server-side with the admin client purely for display.
  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(userList.users.map((u) => [u.id, u.email ?? ""]));

  const clients: AdminClient[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || null,
    email: emailById.get(p.id) ?? "",
    programCount: p.programs[0]?.count ?? 0,
    membership: isMembership(p.membership) ? (p.membership as Membership) : null,
    membershipEndDate: p.membership_end_date,
  }));

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <AdminClientsView clients={clients} />
      </main>
    </div>
  );
}
