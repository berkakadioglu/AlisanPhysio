import Link from "next/link";
import { Check, MoveRight } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import {
  MARKETING,
  marketingText,
} from "@/lib/marketing-content";

type PricingPlan = (typeof MARKETING.pricing.plans)[number];

function formatPrice(lang: Lang, amount: number, currency: string) {
  return new Intl.NumberFormat(
    currency === "CAD" ? "en-US" : MARKETING.locale[lang],
    {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    maximumFractionDigits: 0,
    },
  ).format(amount);
}

function PricingCard({ lang, plan }: { lang: Lang; plan: PricingPlan }) {
  const copy = MARKETING.pricing;
  const price = marketingText(lang, plan.price);
  const hasPrice = price.amount > 0;

  return (
    <article className="marketing-price-card marketing-price-card--primary" data-marketing-reveal>
      <div className="marketing-price-card__topline">
        <h3>{marketingText(lang, plan.name)}</h3>
      </div>
      <p className="marketing-price-card__description">{marketingText(lang, plan.description)}</p>
      <div className="marketing-price-card__price-block">
        <div className={`marketing-price-card__price${!hasPrice ? " is-contact" : ""}`}>
          <strong>{hasPrice ? formatPrice(lang, price.amount, price.currency) : marketingText(lang, copy.contactForPricing)}</strong>
          {hasPrice && <span className="marketing-price-card__period">/ {marketingText(lang, copy.periodLabels[price.period])}</span>}
        </div>
      </div>
      <div className="marketing-price-card__features">
        <p>{marketingText(lang, copy.featureListLabel)}</p>
        <ul>
          {copy.sharedFeatures.map((feature) => (
            <li key={feature.en}><Check aria-hidden /><span>{marketingText(lang, feature)}</span></li>
          ))}
        </ul>
      </div>
      <Link href={`/assessment?plan=${plan.id}`} className="marketing-button marketing-button--primary marketing-button--price">
        {marketingText(lang, plan.cta)}<MoveRight aria-hidden />
      </Link>
    </article>
  );
}

export function MarketingPricingPlans({ lang }: { lang: Lang }) {
  const fms = MARKETING.pricing.fms;
  return (
    <div className="marketing-pricing-grid">
      {MARKETING.pricing.plans.map((plan) => <PricingCard key={plan.id} lang={lang} plan={plan} />)}
      <article className="marketing-price-card marketing-price-card--fms" data-marketing-reveal>
        <div className="marketing-price-card__topline"><h3>{marketingText(lang, fms.title)}</h3></div>
        <p className="marketing-price-card__description">{marketingText(lang, fms.description)}</p>
        <div className="marketing-price-card__price-block">
          <div className="marketing-price-card__price"><strong>{marketingText(lang, fms.price)}</strong></div>
          <p className="marketing-price-card__format">{marketingText(lang, fms.format)}</p>
        </div>
        <div className="marketing-price-card__features">
          <p>{marketingText(lang, fms.eyebrow)}</p>
          <ul>{fms.points.map((point) => <li key={point.en}><Check aria-hidden /><span>{marketingText(lang, point)}</span></li>)}</ul>
        </div>
        <Link href="/fms" className="marketing-button marketing-button--secondary marketing-button--price">
          {marketingText(lang, fms.cta)}<MoveRight aria-hidden />
        </Link>
      </article>
    </div>
  );
}

export function MarketingFaq({ lang }: { lang: Lang }) {
  const copy = MARKETING.pricing;

  return (
    <div className="marketing-faq-list" data-marketing-reveal>
      {copy.faqs.map((item, index) => (
        <details key={item.question.en}>
          <summary>
            <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
            <strong>{marketingText(lang, item.question)}</strong>
            <i aria-hidden />
          </summary>
          <p>{marketingText(lang, item.answer)}</p>
        </details>
      ))}
    </div>
  );
}
