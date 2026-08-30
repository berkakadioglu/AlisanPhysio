import { getLang } from "@/lib/i18n-server";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import DemoNavbar from "@/components/demo-navbar";
import MarketingFooter from "@/components/marketing-footer";

export default async function DemoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();

  return (
    <>
      <a href="#main-content" className="marketing-skip-link">
        {marketingText(lang, MARKETING.nav.skipLabel)}
      </a>
      <DemoNavbar lang={lang} />
      {children}
      <MarketingFooter lang={lang} prefetch={false} />
    </>
  );
}

