import type { Metadata } from "next";
import { ArrowDown } from "lucide-react";
import { getLang } from "@/lib/i18n-server";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import {
  MarketingFaq,
  MarketingPricingPlans,
} from "@/components/marketing-pricing";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: marketingText(lang, MARKETING.metadata.pricingTitle),
    description: marketingText(lang, MARKETING.metadata.pricingDescription),
  };
}

export default async function PricingPage() {
  const lang = await getLang();
  const copy = MARKETING.pricing;

  return (
    <main id="main-content" className="marketing-pricing-page">
      <section className="marketing-pricing-hero" aria-labelledby="pricing-page-heading">
        <div className="marketing-container marketing-pricing-hero__inner">
          <div className="marketing-section-kicker" data-marketing-reveal>
            <span className="marketing-section-index" aria-hidden>01</span>
            <p>{marketingText(lang, copy.eyebrow)}</p>
          </div>
          <h1 id="pricing-page-heading" data-marketing-reveal>
            {marketingText(lang, copy.pageTitle)}
          </h1>
          <div className="marketing-pricing-hero__intro" data-marketing-reveal>
            <p>{marketingText(lang, copy.pageIntro)}</p>
            <ArrowDown aria-hidden />
          </div>
        </div>
      </section>

      <section className="marketing-pricing-page__plans" aria-label={marketingText(lang, copy.title)}>
        <div className="marketing-container">
          <h2 className="sr-only">{marketingText(lang, copy.title)}</h2>
          <MarketingPricingPlans lang={lang} />
          <p className="marketing-pricing-page__note" data-marketing-reveal>
            {marketingText(lang, copy.gettingStartedNote)}
          </p>
        </div>
      </section>

      <section className="marketing-faq" aria-labelledby="faq-heading">
        <div className="marketing-container marketing-faq__grid">
          <div className="marketing-faq__heading">
            <div className="marketing-section-kicker" data-marketing-reveal>
              <span className="marketing-section-index" aria-hidden>02</span>
              <p>{marketingText(lang, copy.faqEyebrow)}</p>
            </div>
            <h2 id="faq-heading" data-marketing-reveal>
              {marketingText(lang, copy.faqTitle)}
            </h2>
            <p data-marketing-reveal>{marketingText(lang, copy.faqIntro)}</p>
          </div>
          <MarketingFaq lang={lang} />
        </div>
      </section>
    </main>
  );
}
