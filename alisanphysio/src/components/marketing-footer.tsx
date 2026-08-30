import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import {
  MARKETING,
  marketingTemplate,
  marketingText,
} from "@/lib/marketing-content";

export default function MarketingFooter({
  lang,
  prefetch = true,
}: {
  lang: Lang;
  prefetch?: boolean;
}) {
  const copy = MARKETING.footer;

  return (
    <footer className="marketing-footer">
      <div className="marketing-container marketing-footer__grid">
        <div>
          <Link href="/" prefetch={prefetch} className="marketing-wordmark">
            {MARKETING.brand.name}
          </Link>
          <p className="marketing-footer__blurb">
            {marketingText(lang, copy.blurb)}
          </p>
        </div>

        <nav
          className="marketing-footer__links"
          aria-label={marketingText(lang, copy.navLabel)}
        >
          {copy.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={prefetch}
              className={"prominent" in link && link.prominent ? "is-prominent" : undefined}
            >
              {marketingText(lang, link.label)}
            </Link>
          ))}
        </nav>

        <div className="marketing-footer__social">
          <p>{marketingText(lang, copy.socialTitle)}</p>
          <div aria-label={marketingText(lang, copy.socialState)}>
            {copy.socialNames.map((name) => (
              <span key={marketingText(lang, name)}>{marketingText(lang, name)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="marketing-container marketing-footer__bottom">
        <span>
          {marketingTemplate(marketingText(lang, copy.copyright), {
            year: new Date().getFullYear(),
            brand: MARKETING.brand.name,
          })}
        </span>
        <span>{marketingText(lang, copy.serviceNote)}</span>
      </div>
    </footer>
  );
}
