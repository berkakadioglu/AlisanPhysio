import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { DEMO_DATA } from "@/lib/demo-data";
import DemoPanel from "./demo-panel";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: DEMO_DATA.metadata.title[lang],
    description: DEMO_DATA.metadata.description[lang],
  };
}

export default async function DemoPage() {
  const lang = await getLang();
  return <DemoPanel lang={lang} />;
}
