import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";
import { loadDashboardData, firstNameOf, dayTitlesOf } from "@/lib/dashboard-data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import AppHeader from "./app-header";
import ProgramCard from "./program-card";

export const metadata: Metadata = {
  title: `Dashboard · ${BRAND_NAME}`,
};

export default async function DashboardPage() {
  const { profile, buckets } = await loadDashboardData();
  const firstName = firstNameOf(profile);
  const lang = await getLang();

  return (
    <div className="min-h-screen">
      <AppHeader container="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
          {firstName
            ? t(lang, "dash.welcomeName", { name: firstName })
            : t(lang, "dash.welcome")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {profile?.role === "admin"
            ? t(lang, "dash.subtitleAdmin")
            : t(lang, "dash.subtitleClient")}
        </p>

        {/* This Week — the hero */}
        <section aria-labelledby="this-week" className="mt-8">
          <p
            id="this-week"
            className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {t(lang, "dash.thisWeek")}
          </p>

          {buckets.current.length > 0 ? (
            <div className="space-y-4">
              {buckets.current.map((program) => (
                <ProgramCard
                  key={program.id}
                  id={program.id}
                  title={program.title}
                  weekStartDate={program.week_start_date}
                  notes={program.notes}
                  exerciseCount={program.exercises[0]?.count ?? 0}
                  dayTitles={dayTitlesOf(program)}
                  hero
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
              <p className="font-display text-lg font-bold text-foreground">
                {t(lang, "dash.noThisWeekTitle")}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t(lang, "dash.noThisWeekBody")}
              </p>
            </div>
          )}
        </section>

        {/* Quiet navigation to the other buckets */}
        <nav className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/past"
            className="group flex flex-1 items-center gap-3 rounded-2xl border border-border bg-surface/60 px-5 py-4 transition hover:border-brand/30 hover:bg-surface"
          >
            <span
              aria-hidden
              className="text-subtle-foreground transition group-hover:-translate-x-0.5 group-hover:text-brand"
            >
              ←
            </span>
            <span className="text-sm font-medium text-muted-foreground transition group-hover:text-brand">
              {t(lang, "dash.pastPrograms")}
            </span>
            <span className="ml-auto rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {buckets.past.length}
            </span>
          </Link>

          <Link
            href="/dashboard/upcoming"
            className="group flex flex-1 items-center gap-3 rounded-2xl border border-border bg-surface/60 px-5 py-4 transition hover:border-brand/30 hover:bg-surface"
          >
            <span className="text-sm font-medium text-muted-foreground transition group-hover:text-brand">
              {t(lang, "dash.upcomingPrograms")}
            </span>
            <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {buckets.upcoming.length}
            </span>
            <span
              aria-hidden
              className="ml-auto text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
            >
              →
            </span>
          </Link>
        </nav>
      </main>
    </div>
  );
}
