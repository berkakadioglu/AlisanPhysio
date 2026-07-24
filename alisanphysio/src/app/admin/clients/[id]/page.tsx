import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/constants";
import type { Profile, Program, WeeklyReview } from "@/lib/types";
import { bucketForWeekStart, type Bucket } from "@/lib/week";
import { formatDay, isLang, t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import AdminHeader from "@/app/admin/admin-header";
import MembershipBadge from "@/components/membership-badge";
import ProgramCard from "@/app/dashboard/program-card";
import NewProgramMenu from "./new-program-menu";
import ResetPasswordButton from "./reset-password-button";
import ManageClientButton from "./manage-client-button";
import SendNotificationButton from "./send-notification-button";
import WeeklyReviewsList from "./weekly-reviews-list";

export const metadata: Metadata = {
  title: `Client · ${BRAND_NAME}`,
};

type ProgramWithCount = Program & {
  exercises: { count: number }[];
  program_days: { title: string | null; order_index: number }[];
};

function dayTitlesOf(p: ProgramWithCount): string[] {
  return [...(p.program_days ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((d) => d.title ?? "");
}

const SECTIONS: { key: Bucket; labelKey: string; emptyKey: string }[] = [
  { key: "current", labelKey: "dash.thisWeek", emptyKey: "admin.emptyCurrent" },
  { key: "upcoming", labelKey: "bucket.upcoming", emptyKey: "admin.emptyUpcoming" },
  { key: "past", labelKey: "bucket.past", emptyKey: "admin.emptyPast" },
];

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ manage?: string }>;
}) {
  const { id } = await params;
  const { manage } = await searchParams;
  const { supabase, profile: viewer } = await requireStaff();
  const isAdmin = viewer.role === "admin";
  const lang = await getLang();

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, height_cm, membership, membership_end_date")
    .eq("id", id)
    .maybeSingle<Profile>();

  if (!client) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? "";

  // Client's stored UI language (best-effort; column may not exist pre-0004).
  const { data: langRow } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", id)
    .maybeSingle<{ language: string | null }>();
  const clientLang: Lang = isLang(langRow?.language) ? langRow.language : "en";

  const { data: programs } = await supabase
    .from("programs")
    .select(
      "id, client_id, title, week_start_date, notes, created_at, exercises(count), program_days(title, order_index)",
    )
    .eq("client_id", id)
    .order("week_start_date", { ascending: false })
    .returns<ProgramWithCount[]>();

  // This user's submitted weekly reviews (staff read via RLS).
  const { data: reviews } = await supabase
    .from("weekly_reviews")
    .select("id, user_id, week_start, days_attended, programs_done, hard_exercises, note, created_at")
    .eq("user_id", id)
    .order("week_start", { ascending: false })
    .returns<WeeklyReview[]>();

  const rows = programs ?? [];
  const buckets: Record<Bucket, ProgramWithCount[]> = {
    past: [],
    current: [],
    upcoming: [],
  };
  for (const p of rows) buckets[bucketForWeekStart(p.week_start_date)].push(p);
  buckets.upcoming.reverse();

  // Summaries (most recent first) for the "copy from previous" picker.
  const programSummaries = rows.map((p) => ({
    id: p.id,
    title: p.title,
    weekStartDate: p.week_start_date,
    dayTitles: dayTitlesOf(p),
    exerciseCount: p.exercises[0]?.count ?? 0,
  }));
  const displayName = client.full_name?.trim() || email || "Unnamed client";

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "admin.allClients")}
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground break-words sm:text-3xl">
                {displayName}
              </h1>
              {client.role !== "client" ? (
                <span className="rounded-full border border-brand/30 bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {t(lang, `role.${client.role}`)}
                </span>
              ) : (
                client.membership && (
                  <span className="inline-flex items-center gap-2">
                    <MembershipBadge membership={client.membership} />
                    <span className="text-xs text-subtle-foreground">
                      {client.membership_end_date
                        ? t(lang, "membership.until", {
                            date: formatDay(client.membership_end_date, lang),
                          })
                        : t(lang, "membership.noExpiry")}
                    </span>
                  </span>
                )
              )}
            </div>
            {client.full_name?.trim() && email && (
              <p className="mt-1.5 break-words text-sm text-muted-foreground">
                {email}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/clients/${id}/data`}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
            >
              {t(lang, "admin.viewData")}
            </Link>
            <Link
              href={`/admin/clients/${id}/nutrition`}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-brand/40 hover:text-brand"
            >
              {t(lang, "nutri.managePlan")}
            </Link>
            <ManageClientButton
              clientId={id}
              fullName={client.full_name ?? ""}
              email={email}
              language={clientLang}
              height={client.height_cm}
              membership={client.membership}
              membershipEndDate={client.membership_end_date}
              role={client.role}
              isAdmin={isAdmin}
              isSelf={viewer.id === id}
              defaultOpen={manage === "1"}
            />
            <ResetPasswordButton clientId={id} />
            <SendNotificationButton userId={id} userName={displayName} />
            <NewProgramMenu clientId={id} programs={programSummaries} />
          </div>
        </div>

        <div className="mt-10 space-y-10">
          {SECTIONS.map(({ key, labelKey, emptyKey }) => (
            <section key={key} aria-labelledby={`sec-${key}`}>
              <div className="mb-4 flex items-center gap-2.5 px-1">
                <h2
                  id={`sec-${key}`}
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {t(lang, labelKey)}
                </h2>
                <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {buckets[key].length}
                </span>
              </div>

              {buckets[key].length > 0 ? (
                <div className="space-y-4">
                  {buckets[key].map((program) => (
                    <div key={program.id} className="space-y-1.5">
                      <ProgramCard
                        id={program.id}
                        title={program.title}
                        weekStartDate={program.week_start_date}
                        notes={program.notes}
                        exerciseCount={program.exercises[0]?.count ?? 0}
                        dayTitles={dayTitlesOf(program)}
                        accent={key === "current"}
                        href={`/admin/clients/${id}/programs/${program.id}/edit`}
                      />
                      <div className="px-1 text-right">
                        <Link
                          href={`/dashboard/${program.id}`}
                          className="text-xs font-medium text-muted-foreground transition hover:text-brand"
                        >
                          {t(lang, "admin.viewAsUser")} <span aria-hidden>↗</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-subtle-foreground">
                  {t(lang, emptyKey)}
                </p>
              )}
            </section>
          ))}

          {/* Weekly reviews the user submitted (read-only for staff). */}
          <section aria-labelledby="sec-reviews">
            <div className="mb-4 flex items-center gap-2.5 px-1">
              <h2
                id="sec-reviews"
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {t(lang, "review.staffHeading")}
              </h2>
              <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {reviews?.length ?? 0}
              </span>
            </div>
            <WeeklyReviewsList reviews={reviews ?? []} lang={lang} />
          </section>
        </div>
      </main>
    </div>
  );
}
