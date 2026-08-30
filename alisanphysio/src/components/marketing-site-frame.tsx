import { getLang } from "@/lib/i18n-server";
import { getViewer } from "@/lib/viewer";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import { portalPathForRole } from "@/lib/route-access";
import MarketingFooter from "@/components/marketing-footer";
import MarketingMotion from "@/components/marketing-motion";
import MarketingNavbar from "@/components/marketing-navbar";

/** Auth-aware chrome used only by the live marketing pages, never /demo. */
export default async function MarketingSiteFrame({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [lang, viewer] = await Promise.all([getLang(), getViewer()]);
  const isStaff = viewer?.role === "admin" || viewer?.role === "manager";
  const portalHref = portalPathForRole(viewer?.role, Boolean(viewer));
  const portalLabel = viewer
    ? marketingText(
        lang,
        isStaff ? MARKETING.nav.portal.staff : MARKETING.nav.portal.client,
      )
    : marketingText(lang, MARKETING.nav.portal.anonymous);

  return (
    <>
      <a href="#main-content" className="marketing-skip-link">
        {marketingText(lang, MARKETING.nav.skipLabel)}
      </a>
      <MarketingNavbar
        lang={lang}
        portalHref={portalHref}
        portalLabel={portalLabel}
      />
      <MarketingMotion lang={lang} />
      {children}
      <MarketingFooter lang={lang} />
    </>
  );
}

