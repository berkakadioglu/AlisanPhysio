import { redirect } from "next/navigation";

/** The saved-day editor now lives under Programmes. */
export default function NewTemplatePage() {
  redirect("/admin/programs/saved-days/new");
}
