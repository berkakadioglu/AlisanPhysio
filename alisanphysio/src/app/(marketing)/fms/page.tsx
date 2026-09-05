import { getLang } from "@/lib/i18n-server";
import { fmsCopy } from "@/lib/fms-copy";
import FmsForm from "./fms-form";
export async function generateMetadata() {
  return { title: `${fmsCopy(await getLang()).title} · Train with Alisan` };
}
export default async function FmsPage() {
  const lang = await getLang();
  return <main id="main-content" className="mx-auto min-w-0 max-w-3xl px-5 pb-12 pt-28 sm:px-8 sm:pb-16 sm:pt-32"><FmsForm lang={lang} /></main>;
}
