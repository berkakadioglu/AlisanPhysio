import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Mail } from "lucide-react";
import { assessmentPlanLabel, type AssessmentRequest } from "@/lib/assessment";
import { requireAdmin } from "@/lib/admin-auth";
import { bmiCategory, computeBmi } from "@/lib/bmi";
import { BRAND_NAME } from "@/lib/constants";
import { getLang } from "@/lib/i18n-server";
import { t, type Lang } from "@/lib/i18n";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import AdminHeader from "../../admin-header";
import RequestActions from "../request-actions";
import RequestStatusBadge from "../request-status-badge";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "requests.metaTitle")} · ${BRAND_NAME}` };
}

function formatDate(value: string | null, lang: Lang) {
  if (!value) return t(lang, "requests.notProvided");
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DetailGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; long?: boolean }>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/70 p-5 shadow-soft sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className={row.long ? "sm:col-span-2" : ""}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
              {row.label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ supabase }, lang, { id }] = await Promise.all([
    requireAdmin(),
    getLang(),
    params,
  ]);

  const { data } = await supabase
    .from("assessment_requests")
    .select(
      "id, created_at, full_name, email, phone, country, city, preferred_language, birth_year, sex, height_cm, weight_kg, primary_goal, biggest_expectation, training_experience, days_per_week, equipment_access, injury_history, medical_notes, selected_plan, message, status, admin_note, reviewed_at",
    )
    .eq("id", id)
    .maybeSingle<AssessmentRequest>();

  if (!data) notFound();

  const empty = t(lang, "requests.notProvided");
  const clean = (value: string | number | null) =>
    value == null || value === "" ? empty : String(value);
  const optionLabel = (
    options: ReadonlyArray<{
      value: string;
      label: Readonly<Record<Lang, string>>;
    }>,
    value: string | null,
  ) => {
    const match = options.find((option) => option.value === value);
    return match ? marketingText(lang, match.label) : clean(value);
  };
  const planLabel = assessmentPlanLabel(lang, data.selected_plan);
  const approximateAge = data.birth_year
    ? new Date().getUTCFullYear() - data.birth_year
    : null;
  const bmi = computeBmi(data.weight_kg, data.height_cm);
  const bmiLabel =
    bmi == null
      ? empty
      : `${new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-CA", {
          maximumFractionDigits: 1,
        }).format(bmi)} · ${t(lang, `bmi.note.${bmiCategory(bmi)}`)}`;

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/admin/requests"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t(lang, "requests.back")}
        </Link>

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
              {data.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 break-all">
                <Mail className="h-4 w-4 flex-none" aria-hidden />
                {data.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 flex-none" aria-hidden />
                {formatDate(data.created_at, lang)}
              </span>
            </div>
          </div>
          <RequestStatusBadge status={data.status} lang={lang} />
        </header>

        <div className="mt-8 space-y-6">
          <RequestActions
            id={data.id}
            email={data.email}
            initialStatus={data.status}
            initialNote={data.admin_note}
            lang={lang}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <DetailGroup
              title={t(lang, "requests.contactGroup")}
              rows={[
                { label: t(lang, "requests.fullName"), value: data.full_name },
                { label: t(lang, "requests.email"), value: data.email },
                { label: t(lang, "requests.phone"), value: clean(data.phone) },
                { label: t(lang, "requests.country"), value: clean(data.country) },
                { label: t(lang, "requests.city"), value: clean(data.city) },
                {
                  label: t(lang, "requests.preferredLanguage"),
                  value: t(lang, `requests.language.${data.preferred_language}`),
                },
              ]}
            />
            <DetailGroup
              title={t(lang, "requests.profileGroup")}
              rows={[
                { label: t(lang, "requests.birthYear"), value: clean(data.birth_year) },
                { label: t(lang, "requests.approxAge"), value: clean(approximateAge) },
                {
                  label: t(lang, "requests.sex"),
                  value: optionLabel(MARKETING.assessment.options.sex, data.sex),
                },
                { label: t(lang, "requests.height"), value: data.height_cm == null ? empty : `${data.height_cm} cm` },
                { label: t(lang, "requests.weight"), value: data.weight_kg == null ? empty : `${data.weight_kg} kg` },
                { label: t(lang, "requests.bmi"), value: bmiLabel, long: true },
                { label: t(lang, "requests.primaryGoal"), value: data.primary_goal, long: true },
                { label: t(lang, "requests.biggestExpectation"), value: clean(data.biggest_expectation), long: true },
              ]}
            />
            <DetailGroup
              title={t(lang, "requests.trainingGroup")}
              rows={[
                {
                  label: t(lang, "requests.experience"),
                  value: optionLabel(
                    MARKETING.assessment.options.experience,
                    data.training_experience,
                  ),
                },
                { label: t(lang, "requests.days"), value: clean(data.days_per_week) },
                {
                  label: t(lang, "requests.equipment"),
                  value: optionLabel(
                    MARKETING.assessment.options.equipment,
                    data.equipment_access,
                  ),
                },
              ]}
            />
            <DetailGroup
              title={t(lang, "requests.healthGroup")}
              rows={[
                { label: t(lang, "requests.injury"), value: clean(data.injury_history), long: true },
                { label: t(lang, "requests.medical"), value: clean(data.medical_notes), long: true },
              ]}
            />
          </div>

          <DetailGroup
            title={t(lang, "requests.contextGroup")}
            rows={[
              { label: t(lang, "requests.plan"), value: planLabel },
              { label: t(lang, "requests.created"), value: formatDate(data.created_at, lang) },
              { label: t(lang, "requests.reviewedAt"), value: formatDate(data.reviewed_at, lang) },
              { label: t(lang, "requests.message"), value: clean(data.message), long: true },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
