import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { MARKETING, marketingText } from "@/lib/marketing-content";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const description = marketingText(lang, MARKETING.metadata.homeDescription);

  return {
    title: marketingText(lang, MARKETING.metadata.homeTitle),
    description,
    icons: { icon: "/favicon.ico" },
    openGraph: {
      type: "website",
      title: marketingText(lang, MARKETING.metadata.homeTitle),
      description,
      siteName: MARKETING.brand.name,
      locale: lang === "tr" ? "tr_TR" : "en_US",
    },
  };
}

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="marketing">{children}</div>;
}
