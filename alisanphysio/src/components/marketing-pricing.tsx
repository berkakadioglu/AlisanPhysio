import Link from "next/link";
import { Check, MoveRight } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import {
  MARKETING,
  marketingTemplate,
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

function PricingCard({
  lang,
  plan,
  monthlyAnchor,
}: {
  lang: Lang;
  plan: PricingPlan;
  monthlyAnchor: number;
}) {
  const copy = MARKETING.pricing;
  const price = marketingText(lang, plan.price);
  const equivalent = marketingText(lang, plan.monthlyEquivalent);
  const hasPrice = price.amount > 0;
  const formattedPrice = hasPrice
    ? formatPrice(lang, price.amount, price.currency)
    : marketingText(lang, copy.contactForPricing);
  const anchorAmount = monthlyAnchor * 3;
  const saving =
    plan.recommended && hasPrice && anchorAmount > 0
      ? Math.round((1 - price.amount / anchorAmount) * 100)
      : 0;

  return (
    <article
      className={`marketing-price-card${plan.recommended ? " marketing-price-card--recommended" : ""}`}
      data-marketing-reveal
    >
      <div className="marketing-price-card__topline">
        <h3>{marketingText(lang, plan.name)}</h3>
        {plan.recommended && (
          <span>{marketingText(lang, copy.mostPopular)}</span>
        )}
      </div>

      <p className="marketing-price-card__description">
        {marketingText(lang, plan.description)}
      </p>

      <div className="marketing-price-card__price-block">
        {plan.recommended && hasPrice && (
          <div className="marketing-price-card__anchor">
            <span>{marketingText(lang, copy.anchorLabel)}</span>
            <s>{formatPrice(lang, anchorAmount, price.currency)}</s>
          </div>
        )}
        <div className={`marketing-price-card__price${!hasPrice ? " is-contact" : ""}`}>
          <strong>{formattedPrice}</strong>
          {hasPrice && (
            <span className="marketing-price-card__period">
              / {marketingText(lang, copy.periodLabels[price.period])}
            </span>
          )}
        </div>
        {hasPrice && (
          <p className="marketing-price-card__equivalent">
            {marketingTemplate(
              marketingText(lang, copy.equivalentLabel),
              {
                price: formatPrice(
                  lang,
                  equivalent.amount,
                  equivalent.currency,
                ),
              },
            )}
          </p>
        )}
        {saving > 0 && (
          <p className="marketing-price-card__saving">
            {marketingTemplate(marketingText(lang, copy.saveLabel), {
              percent: saving,
            })}
          </p>
        )}
      </div>

      <div className="marketing-price-card__features">
        <p>{marketingText(lang, copy.featureListLabel)}</p>
        <ul>
          {copy.sharedFeatures.map((feature) => (
            <li key={feature.en}>
              <Check aria-hidden />
              <span>{marketingText(lang, feature)}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/assessment?plan=${plan.id}`}
        className="marketing-button marketing-button--price"
      >
        {marketingText(lang, plan.cta)}
        <MoveRight aria-hidden />
      </Link>
    </article>
  );
}

export function MarketingPricingPlans({ lang }: { lang: Lang }) {
  const monthly = MARKETING.pricing.plans[0].price[lang].amount;

  return (
    <div className="marketing-pricing-grid">
      {MARKETING.pricing.plans.map((plan) => (
        <PricingCard
          key={plan.id}
          lang={lang}
          plan={plan}
          monthlyAnchor={monthly}
        />
      ))}
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
