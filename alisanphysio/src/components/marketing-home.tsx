import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  HeartPulse,
  MessageCircle,
  PanelsTopLeft,
  Play,
  Plus,
  RefreshCw,
  Star,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/lib/i18n";
import {
  MARKETING,
  marketingTemplate,
  marketingText,
} from "@/lib/marketing-content";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { MarketingPricingPlans } from "@/components/marketing-pricing";

const benefitIcons: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  heartPulse: HeartPulse,
  portal: PanelsTopLeft,
  message: MessageCircle,
  chart: BarChart3,
  refresh: RefreshCw,
};

function SectionIndex({ value }: { value: number }) {
  return (
    <span className="marketing-section-index" aria-hidden>
      {String(value).padStart(2, "0")}
    </span>
  );
}

function HeroMedia({ lang }: { lang: Lang }) {
  const copy = MARKETING.hero;
  const videoId = marketingText(lang, copy.videoId);

  return (
    <div className="marketing-hero-media" data-marketing-reveal>
      {videoId ? (
        <iframe
          src={`${youtubeEmbedUrl(videoId)}?rel=0`}
          title={marketingText(lang, copy.videoTitle)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="marketing-hero-poster">
          <Image
            src={copy.poster}
            alt={marketingText(lang, copy.posterAlt)}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 70vw"
          />
          <div className="marketing-hero-poster__scrim" />
          <span className="marketing-hero-poster__play" aria-hidden>
            <Play fill="currentColor" />
          </span>
          <p>{marketingText(lang, copy.comingSoon)}</p>
        </div>
      )}
    </div>
  );
}

export default function MarketingHome({ lang }: { lang: Lang }) {
  const hero = MARKETING.hero;
  const about = MARKETING.about;
  const why = MARKETING.why;
  const demoEntry = MARKETING.demoEntry;
  const reviews = MARKETING.reviews;
  const pricing = MARKETING.pricing;
  const cta = MARKETING.cta;
  const headlineLines = marketingText(lang, hero.headline);

  return (
    <main id="main-content" className="marketing-main">
      <section id="hero" className="marketing-hero" aria-labelledby="hero-heading">
        <div className="marketing-container marketing-hero__copy">
          <div className="marketing-hero__rail" data-marketing-reveal>
            <SectionIndex value={1} />
            <span>{marketingText(lang, hero.scrollLabel)}</span>
            <ArrowDown aria-hidden />
          </div>
          <div className="marketing-hero__content">
            <p className="marketing-eyebrow marketing-delay-1" data-marketing-reveal>
              {marketingText(lang, hero.eyebrow)}
            </p>
            <h1
              id="hero-heading"
              className="marketing-delay-2"
              data-headline={headlineLines.join("\n")}
              data-marketing-reveal
              style={{ "--headline-line-count": headlineLines.length } as CSSProperties}
            >
              {headlineLines.map((line, index) => (
                <span
                  key={index}
                  className="marketing-hero__headline-line"
                  style={{ "--headline-line-index": index } as CSSProperties}
                >
                  <span data-line={line}>{line}</span>
                </span>
              ))}
              <span className="marketing-hero__headline-sweep" aria-hidden="true">
                {headlineLines.join("\n")}
              </span>
            </h1>
            <div className="marketing-hero__intro marketing-delay-3" data-marketing-reveal>
              <p>{marketingText(lang, hero.subhead)}</p>
              <div className="marketing-button-row">
                <Link href="/pricing" className="marketing-button marketing-button--primary">
                  {marketingText(lang, hero.primaryCta)}
                  <ArrowUpRight aria-hidden />
                </Link>
                <Link href="/#about" className="marketing-button marketing-button--secondary">
                  {marketingText(lang, hero.secondaryCta)}
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div
          className="marketing-credibility-strip"
          aria-label={marketingText(lang, hero.credibilityLabel)}
        >
          <div className="marketing-container marketing-credibility-strip__track">
            {hero.credibilityItems.map((item) => (
              <span key={item.en}>{marketingText(lang, item)}</span>
            ))}
          </div>
        </div>
        <div className="marketing-container marketing-hero__media-wrap">
          <HeroMedia lang={lang} />
        </div>
      </section>

      <section id="about" className="marketing-about" aria-labelledby="about-heading">
        <div className="marketing-container marketing-about__grid">
          <div className="marketing-about__copy">
            <div className="marketing-section-kicker" data-marketing-reveal>
              <SectionIndex value={2} />
              <p>{marketingText(lang, about.eyebrow)}</p>
            </div>
            <h2 id="about-heading" data-marketing-reveal>
              {marketingText(lang, about.title)}
            </h2>
            <div className="marketing-about__bio" data-marketing-reveal>
              {about.bio.map((paragraph) => (
                <p key={paragraph.en}>
                  {marketingText(lang, paragraph)}
                </p>
              ))}
            </div>
            <div className="marketing-about__credentials" data-marketing-reveal>
              <p>{marketingText(lang, about.credentialsLabel)}</p>
              <ul>
                {about.credentials.map((credential) => (
                  <li key={credential.en}>
                    <CheckCircle2 aria-hidden />
                    <span>{marketingText(lang, credential)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <figure className="marketing-about__portrait" data-marketing-reveal>
            <Image
              src={about.portrait}
              alt={marketingText(lang, about.portraitAlt)}
              width={900}
              height={1200}
              sizes="(max-width: 767px) 100vw, 42vw"
            />
            <figcaption>{MARKETING.brand.trainerName}</figcaption>
          </figure>
          <div className="marketing-about__stats">
            {about.stats.map((stat) => (
              <div key={stat.count}>
                <strong
                  data-marketing-count={stat.count}
                  data-marketing-count-suffix={stat.suffix}
                >
                  {marketingText(lang, stat.value)}
                </strong>
                <span>{marketingText(lang, stat.label)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="marketing-why" aria-labelledby="why-heading">
        <div className="marketing-container">
          <div className="marketing-section-heading marketing-section-heading--split">
            <div className="marketing-section-kicker" data-marketing-reveal>
              <SectionIndex value={3} />
              <p>{marketingText(lang, why.eyebrow)}</p>
            </div>
            <h2 id="why-heading" data-marketing-reveal>
              {marketingText(lang, why.title)}
            </h2>
            <p data-marketing-reveal>{marketingText(lang, why.intro)}</p>
          </div>
          <div className="marketing-benefit-grid">
            {why.items.map((item, index) => {
              const Icon = benefitIcons[item.icon];
              return (
                <article
                  key={item.icon}
                  className={`marketing-benefit marketing-benefit--${index + 1}`}
                  data-marketing-reveal
                >
                  <Icon aria-hidden />
                  <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{marketingText(lang, item.title)}</h3>
                  <p>{marketingText(lang, item.body)}</p>
                </article>
              );
            })}
          </div>
          <div className="marketing-demo-entry" data-marketing-reveal>
            <div>
              <p className="marketing-eyebrow">
                {marketingText(lang, demoEntry.eyebrow)}
              </p>
              <h3>{marketingText(lang, demoEntry.title)}</h3>
              <p>{marketingText(lang, demoEntry.body)}</p>
            </div>
            <Link
              href={demoEntry.href}
              className="marketing-button marketing-button--secondary"
            >
              {marketingText(lang, demoEntry.cta)}
              <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <div
        className="marketing-ticker"
        aria-label={marketingText(lang, MARKETING.ticker.label)}
      >
        <div className="marketing-ticker__track" aria-hidden>
          {[0, 1].map((group) => (
            <div className="marketing-ticker__group" key={group}>
              {MARKETING.ticker.words.map((word) => (
                <span key={`${group}-${word.en}`}>
                  {marketingText(lang, word)}
                  <Plus aria-hidden />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section id="reviews" className="marketing-reviews" aria-labelledby="reviews-heading">
        <div className="marketing-container">
          <div className="marketing-section-heading">
            <div className="marketing-section-kicker" data-marketing-reveal>
              <SectionIndex value={4} />
              <p>{marketingText(lang, reviews.eyebrow)}</p>
            </div>
            <h2 id="reviews-heading" data-marketing-reveal>
              {marketingText(lang, reviews.title)}
            </h2>
            <p data-marketing-reveal>{marketingText(lang, reviews.intro)}</p>
          </div>
          <div className="marketing-review-grid">
            {reviews.items.map((review, index) => (
              <figure
                key={review.name.en}
                className={`marketing-review marketing-review--${index + 1}`}
                data-marketing-reveal
              >
                <div
                  className="marketing-review__rating"
                  aria-label={marketingTemplate(
                    marketingText(lang, reviews.ratingLabel),
                    { rating: review.rating },
                  )}
                >
                  {Array.from({ length: review.rating }).map((_, star) => (
                    <Star key={star} fill="currentColor" aria-hidden />
                  ))}
                </div>
                <blockquote>“{marketingText(lang, review.quote)}”</blockquote>
                <figcaption>
                  <Image
                    src={reviews.avatar}
                    alt={marketingText(lang, reviews.avatarAlt)}
                    width={48}
                    height={48}
                  />
                  <span>
                    <strong>{marketingText(lang, review.name)}</strong>
                    <small>{marketingText(lang, review.descriptor)}</small>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="marketing-pricing" aria-labelledby="pricing-heading">
        <div className="marketing-container">
          <div className="marketing-section-heading marketing-section-heading--split">
            <div className="marketing-section-kicker" data-marketing-reveal>
              <SectionIndex value={5} />
              <p>{marketingText(lang, pricing.eyebrow)}</p>
            </div>
            <h2 id="pricing-heading" data-marketing-reveal>
              {marketingText(lang, pricing.title)}
            </h2>
            <p data-marketing-reveal>{marketingText(lang, pricing.intro)}</p>
          </div>
          <MarketingPricingPlans lang={lang} />
          <div className="marketing-pricing__foot" data-marketing-reveal>
            <p>{marketingText(lang, pricing.gettingStartedNote)}</p>
            <Link href="/pricing" className="marketing-text-link">
              {marketingText(lang, pricing.viewAllCta)}
              <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section id="cta" className="marketing-cta" aria-labelledby="cta-heading">
        <div className="marketing-container marketing-cta__inner">
          <div className="marketing-section-kicker" data-marketing-reveal>
            <SectionIndex value={6} />
            <p>{marketingText(lang, cta.eyebrow)}</p>
          </div>
          <h2 id="cta-heading" data-marketing-reveal>
            {marketingText(lang, cta.title)}
          </h2>
          <div data-marketing-reveal>
            <p>{marketingText(lang, cta.body)}</p>
            <Link href="/pricing" className="marketing-button marketing-button--light">
              {marketingText(lang, cta.button)}
              <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
