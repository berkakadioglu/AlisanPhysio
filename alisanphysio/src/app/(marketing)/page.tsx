import { getLang } from "@/lib/i18n-server";
import MarketingHome from "@/components/marketing-home";
import MarketingSiteFrame from "@/components/marketing-site-frame";

export default async function MarketingHomePage() {
  const lang = await getLang();
  return (
    <MarketingSiteFrame>
      <MarketingHome lang={lang} />
    </MarketingSiteFrame>
  );
}
