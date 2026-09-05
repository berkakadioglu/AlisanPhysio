import type { Metadata } from "next";
import { ArrowDown, ShieldCheck } from "lucide-react";
import { normalizeAssessmentPlan } from "@/lib/assessment";
import { getLang } from "@/lib/i18n-server";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import AssessmentForm from "./assessment-form";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: marketingText(lang, MARKETING.assessment.metaTitle),
    description: marketingText(lang, MARKETING.assessment.metaDescription),
  };
}

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const [lang, query] = await Promise.all([getLang(), searchParams]);
  const copy = MARKETING.assessment;

  return (
    <main id="main-content" className="marketing-assessment-page">
      <section
        className="marketing-assessment-hero"
        aria-labelledby="assessment-heading"
      >
        <div className="marketing-container marketing-assessment-hero__inner">
          <div className="marketing-assessment-hero__copy">
            <div className="marketing-section-kicker" data-marketing-reveal>
              <span className="marketing-section-index" aria-hidden>
                01
              </span>
              <p>{marketingText(lang, copy.eyebrow)}</p>
            </div>
            <h1 id="assessment-heading" data-marketing-reveal>
              {marketingText(lang, copy.title)}
            </h1>
            <p data-marketing-reveal>{marketingText(lang, copy.intro)}</p>
          </div>
          <div className="marketing-assessment-hero__mark" data-marketing-reveal>
            <ShieldCheck aria-hidden />
            <ArrowDown aria-hidden />
          </div>
        </div>
      </section>

      <section
        className="marketing-assessment-form-section"
        aria-label={marketingText(lang, copy.formLabel)}
      >
        <div className="marketing-container">
          <div className="marketing-assessment-form-reveal" data-marketing-reveal>
            <AssessmentForm
              lang={lang}
              initialPlan={normalizeAssessmentPlan(query.plan)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
