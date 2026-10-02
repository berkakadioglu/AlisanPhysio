import { redirect } from "next/navigation";

/** Day Templates became the "Saved days" tab of Programmes. */
export default function TemplatesPage() {
  redirect("/admin/programs?tab=saved-days");
}
