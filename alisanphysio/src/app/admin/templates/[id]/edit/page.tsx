import { redirect } from "next/navigation";
import { isProgramId } from "@/lib/catalog-programs";

/** The saved-day editor now lives under Programmes. */
export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(isProgramId(id) ? `/admin/programs/saved-days/${id}` : "/admin/programs?tab=saved-days");
}
