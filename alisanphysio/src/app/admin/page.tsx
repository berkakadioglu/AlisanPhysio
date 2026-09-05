import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/constants";
import { isMembership, type Membership } from "@/lib/membership";
import type { Role } from "@/lib/types";
import AdminHeader from "./admin-header";
import AdminUsersView, { type AdminUser } from "./admin-clients-view";

export const metadata: Metadata = {
  title: `Users · ${BRAND_NAME}`,
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  membership: string | null;
  membership_end_date: string | null;
  program_reviews: { count: number }[];
};

export default async function AdminHomePage() {
  // Staff (admin OR manager) may view the user list.
  const { supabase } = await requireStaff();

  // ALL users + their review counts. Staff read every profile via RLS
  // (profiles_select_staff). Grouped into tabs client-side.
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, created_at, membership, membership_end_date, program_reviews(count)",
    )
    .order("created_at", { ascending: true })
    .returns<ProfileRow[]>();

  // Emails live in the auth schema (not RLS-readable), so we read them
  // server-side with the admin client purely for display.
  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(userList.users.map((u) => [u.id, u.email ?? ""]));

  const users: AdminUser[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || null,
    email: emailById.get(p.id) ?? "",
    role: p.role,
    reviewCount: p.program_reviews[0]?.count ?? 0,
    membership: isMembership(p.membership) ? (p.membership as Membership) : null,
    membershipEndDate: p.membership_end_date,
  }));

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <AdminUsersView users={users} />
      </main>
    </div>
  );
}
