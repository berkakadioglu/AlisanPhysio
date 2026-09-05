import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  MessageSquareText,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { loadDashboardData, firstNameOf, dayTitlesOf } from "@/lib/dashboard-data";
import { isReviewDue, reviewedProgramSet } from "@/lib/reviews";
import { nutritionPlanSummary } from "@/lib/nutrition";
import { isActiveAppointmentStatus } from "@/lib/scheduling";
import { createClient } from "@/lib/supabase/server";
import { formatMonth, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { ClientAppointment } from "@/lib/types";
import DashboardSectionIntro, {
  DashboardEmptyState,
} from "@/components/dashboard-section-intro";
import ReviewAction from "./review-action";
import AppointmentLocalTime from "./appointment-local-time";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "dash.tab.overview")} · ${BRAND_NAME}` };
}

const cardClass =
  "min-w-0 rounded-2xl border border-border bg-surface/70 p-5 shadow-soft sm:p-6";

/** One stable clock read for the whole server render. */
function requestTimeMs(): number {
  return Date.now();
}

export default async function DashboardPage() {
  const { profile, buckets } = await loadDashboardData();

  const firstName = firstNameOf(profile);
  const lang = await getLang();
  const reviewedPrograms = await reviewedProgramSet();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = requestTimeMs();

  const [nutrition, appointmentResult, measurementResult, timezoneResult] = user
    ? await Promise.all([
        profile?.nutrition_enabled ? nutritionPlanSummary(supabase, user.id) : Promise.resolve({ hasPlan: false, mealCount: 0 }),
        supabase
          .rpc("get_own_appointments", {
            p_from: new Date(now - 24 * 60 * 60 * 1_000).toISOString(),
            p_to: null,
          }),
        supabase
          .from("measurements")
          .select("id", { count: "exact", head: true })
          .eq("client_id", user.id),
        supabase
          .from("profiles")
          .select("timezone")
          .eq("id", user.id)
          .maybeSingle<{ timezone: string | null }>(),
      ])
    : [
        { hasPlan: false, mealCount: 0 },
        { data: [] as ClientAppointment[] },
        { count: 0 },
        { data: null as { timezone: string | null } | null },
      ];

  const appointments = Array.isArray(appointmentResult.data)
    ? (appointmentResult.data as ClientAppointment[])
    : [];
  const nextAppointment = appointments
    .filter(
      (appointment) =>
        isActiveAppointmentStatus(appointment.status) &&
        Date.parse(appointment.starts_at) + appointment.duration_min * 60_000 > now,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null;
  const storedTimeZone = timezoneResult.data?.timezone ?? null;
  const current = buckets.current[0] ?? null;
  const currentExercises = buckets.current.reduce(
    (sum, program) => sum + (program.exercises[0]?.count ?? 0),
    0,
  );
  const currentDays = buckets.current.reduce(
    (sum, program) => sum + (program.program_days?.length ?? 0),
    0,
  );
  const measurementCount = measurementResult.count ?? 0;
  const numberOrDash = (value: number) => (value > 0 ? String(value) : "—");

  const metrics = [
    { value: numberOrDash(currentDays), label: t(lang, "dash.metric.trainingDays") },
    { value: numberOrDash(currentExercises), label: t(lang, "dash.metric.exercises") },
    ...(profile?.nutrition_enabled ? [{ value: numberOrDash(nutrition.mealCount), label: t(lang, "dash.metric.meals") }] : []),
    { value: numberOrDash(measurementCount), label: t(lang, "dash.metric.measurements") },
  ];

  return (
    <main id="main-content" className="min-w-0">
      <DashboardSectionIntro
        eyebrow={t(lang, "dash.overviewEyebrow")}
        title={
          firstName
            ? t(lang, "dash.welcomeName", { name: firstName })
            : t(lang, "dash.welcome")
        }
        body={
          profile?.role === "admin"
            ? t(lang, "dash.subtitleAdmin")
            : t(lang, "dash.overviewBody")
        }
      />

      <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded-2xl border border-border bg-background/70 p-3.5 sm:p-4"
          >
            <dd className="break-words font-display text-xl font-extrabold tabular-nums text-foreground sm:text-2xl">
              {metric.value}
            </dd>
            <dt className="mt-1 text-xs leading-snug text-muted-foreground">
              {metric.label}
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        <article className={`${cardClass} flex flex-col`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {t(lang, "dash.thisMonth")}
              </p>
              <h2 className="mt-2 break-words font-display text-xl font-bold text-foreground">
                {current?.title ?? t(lang, "dash.noThisMonthTitle")}
              </h2>
            </div>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
              <Dumbbell className="h-5 w-5" aria-hidden />
            </span>
          </div>
          {current ? (
            <>
              <p className="mt-3 text-sm font-semibold text-brand">
                {formatMonth(current.month_start_date, lang)}
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {dayTitlesOf(current).filter(Boolean).join(" · ") ||
                  t(lang, "dash.programmeReadyBody")}
              </p>
              <Link
                href={`/dashboard/${current.id}`}
                className="mt-5 inline-flex min-h-11 items-center gap-2 self-start rounded-full text-sm font-bold text-brand transition hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                {t(lang, "dash.openProgramme")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {t(lang, "dash.noThisMonthBody")}
            </p>
          )}
        </article>

        <article className={`${cardClass} flex flex-col`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {t(lang, "dash.appointmentEyebrow")}
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-foreground">
                {t(lang, "schedule.nextAppointment")}
              </h2>
            </div>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
          </div>
          {nextAppointment ? (
            <div className="mt-4 flex flex-1 flex-col">
              <AppointmentLocalTime
                startsAt={nextAppointment.starts_at}
                storedTimeZone={storedTimeZone}
                locale={lang === "tr" ? "tr-TR" : "en-GB"}
                unavailableLabel={t(lang, "profile.timezoneUnset")}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-brand-tint px-2.5 py-1 text-brand">
                  {t(lang, `schedule.status.${nextAppointment.status}`)}
                </span>
                <span className="text-muted-foreground">
                  {t(lang, "schedule.durationMinutes", {
                    n: nextAppointment.duration_min,
                  })}
                </span>
              </div>
              {nextAppointment.agenda && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {nextAppointment.agenda}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 flex-1">
              <DashboardEmptyState
                compact
                title={t(lang, "schedule.noAppointments")}
                body={t(lang, "schedule.noAppointmentsBody")}
              />
            </div>
          )}
          <Link
            href="/dashboard/availability"
            className="mt-5 inline-flex min-h-11 items-center gap-2 self-start rounded-full text-sm font-bold text-brand transition hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {t(lang, "schedule.viewSchedule")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </article>

        <article className="min-w-0 rounded-2xl border border-brand/25 bg-brand-tint p-5 sm:p-6">
          <div className="flex items-center gap-2 text-brand">
            <MessageSquareText className="h-4 w-4" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.14em]">
              {t(lang, "dash.coachNoteEyebrow")}
            </p>
          </div>
          {current?.notes ? (
            <>
              <h2 className="mt-3 font-display text-lg font-bold text-foreground">
                {t(lang, "dash.coachNoteTitle")}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                {current.notes}
              </p>
            </>
          ) : (
            <div className="mt-3">
              <DashboardEmptyState
                compact
                title={t(lang, "dash.noCoachNoteTitle")}
                body={t(lang, "dash.noCoachNoteBody")}
              />
            </div>
          )}
        </article>

        {current && (reviewedPrograms.has(current.id) || isReviewDue(current.month_start_date, new Date(now), storedTimeZone)) && (
        <article className={cardClass}>
          <div className="flex items-center gap-2 text-brand">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.14em]">
              {t(lang, "dash.checkInEyebrow")}
            </p>
          </div>
          <h2 className="mt-3 font-display text-lg font-bold text-foreground">
            {t(lang, "dash.checkInTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current ? t(lang, "dash.checkInBody") : t(lang, "dash.noCheckInBody")}
          </p>
          {current && (
            <div className="mt-5">
              <ReviewAction
                programId={current.id}
                monthStartDate={current.month_start_date}
                reviewed={reviewedPrograms.has(current.id)}
                lang={lang}
              />
            </div>
          )}
        </article>
        )}
      </div>
    </main>
  );
}
