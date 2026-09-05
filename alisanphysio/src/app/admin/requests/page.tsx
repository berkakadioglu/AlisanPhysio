import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, MoveRight } from "lucide-react";
import {
  ASSESSMENT_STATUSES,
  assessmentPlanLabel,
  isAssessmentStatus,
  type AssessmentRequest,
  type AssessmentStatus,
} from "@/lib/assessment";
import { requireAdmin } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { getLang } from "@/lib/i18n-server";
import { t, type Lang } from "@/lib/i18n";
import AdminHeader from "../admin-header";
import RequestStatusBadge from "./request-status-badge";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "requests.metaTitle")} · ${BRAND_NAME}` };
}

type RequestListRow = Pick<
  AssessmentRequest,
  | "id"
  | "created_at"
  | "full_name"
  | "email"
  | "country"
  | "selected_plan"
  | "status"
>;

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ supabase }, lang, query] = await Promise.all([
    requireAdmin(),
    getLang(),
    searchParams,
  ]);
  const activeStatus = isAssessmentStatus(query.status) ? query.status : null;

  const { data } = await supabase
    .from("assessment_requests")
    .select(
      "id, created_at, full_name, email, country, selected_plan, status",
    )
    .order("created_at", { ascending: false })
    .returns<RequestListRow[]>();

  const requests = data ?? [];
  const visible = activeStatus
    ? requests.filter((request) => request.status === activeStatus)
    : requests;
  const counts = requests.reduce<Record<AssessmentStatus, number>>(
    (result, request) => {
      result[request.status] += 1;
      return result;
    },
    { new: 0, contacted: 0, accepted: 0, declined: 0 },
  );

  const planLabel = (plan: RequestListRow["selected_plan"]) => assessmentPlanLabel(lang, plan);

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-5xl" />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
              {t(lang, "requests.heading")}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {t(lang, "requests.subtitle")}
            </p>
          </div>
        </header>

        <nav
          aria-label={t(lang, "requests.status")}
          className="mt-7 flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1"
        >
          <Link
            href="/admin/requests"
            aria-current={!activeStatus ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              !activeStatus
                ? "bg-brand-solid text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(lang, "requests.filterAll")} · {requests.length}
          </Link>
          {ASSESSMENT_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/requests?status=${status}`}
              aria-current={activeStatus === status ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                activeStatus === status
                  ? "bg-brand-solid text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(lang, `requests.status.${status}`)} · {counts[status]}
            </Link>
          ))}
        </nav>

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/70 shadow-soft">
          {visible.length > 0 ? (
            <>
              <ul className="divide-y divide-border/60 lg:hidden">
                {visible.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/admin/requests/${request.id}`}
                      className="block space-y-3 px-5 py-5 transition hover:bg-pill/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-foreground">
                            {request.full_name}
                          </p>
                          <p className="mt-1 break-all text-sm text-muted-foreground">
                            {request.email}
                          </p>
                        </div>
                        <RequestStatusBadge status={request.status} lang={lang} />
                      </div>
                      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                            {t(lang, "requests.created")}
                          </dt>
                          <dd className="mt-1 text-muted-foreground">
                            {formatDate(request.created_at, lang)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                            {t(lang, "requests.country")}
                          </dt>
                          <dd className="mt-1 break-words text-muted-foreground">
                            {request.country || t(lang, "requests.notProvided")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                            {t(lang, "requests.plan")}
                          </dt>
                          <dd className="mt-1 text-muted-foreground">
                            {planLabel(request.selected_plan)}
                          </dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3.5">{t(lang, "requests.created")}</th>
                    <th className="px-5 py-3.5">{t(lang, "requests.name")}</th>
                    <th className="px-5 py-3.5">{t(lang, "requests.email")}</th>
                    <th className="px-5 py-3.5">{t(lang, "requests.country")}</th>
                    <th className="px-5 py-3.5">{t(lang, "requests.plan")}</th>
                    <th className="px-5 py-3.5">{t(lang, "requests.status")}</th>
                    <th className="px-5 py-3.5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-border/60 last:border-0 hover:bg-pill/35"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                        {formatDate(request.created_at, lang)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <Link
                          href={`/admin/requests/${request.id}`}
                          className="hover:text-brand"
                        >
                          {request.full_name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {request.email}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {request.country || t(lang, "requests.notProvided")}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {planLabel(request.selected_plan)}
                      </td>
                      <td className="px-5 py-4">
                        <RequestStatusBadge status={request.status} lang={lang} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/requests/${request.id}`}
                          aria-label={`${t(lang, "requests.view")}: ${request.full_name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-brand-tint hover:text-brand"
                        >
                          <MoveRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          ) : (
            <p className="px-6 py-14 text-center text-sm text-subtle-foreground">
              {t(lang, "requests.empty")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
