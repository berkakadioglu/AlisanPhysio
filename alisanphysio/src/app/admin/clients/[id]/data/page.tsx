import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";

/**
 * The old profile-only client data page. It now forwards to the view-as-client
 * profile, so existing links keep working.
 */
export default async function AdminClientDataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaff();
  redirect(`/admin/clients/${id}/view/profile`);
}
