import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { requireStaff } from "@/lib/admin-auth";
import { isProgramId } from "@/lib/catalog-programs";
import { loadClientAppointmentsForStaff } from "@/lib/client-view";
import { isActiveAppointmentStatus } from "@/lib/scheduling";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { ClientAppointment } from "@/lib/types";
import DashboardSectionIntro, {
  DashboardEmptyState,
} from "@/components/dashboard-section-intro";
import AppointmentLocalTime from "@/app/dashboard/appointment-local-time";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "schedule.metaTitle")} · ${BRAND_NAME}` };
}

/** Staff "view as client" schedule: the client's appointments as they see them, read-only. */
export default async function ClientViewAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();

  const { supabase } = await requireStaff();
  const lang = await getLang();

  const [{ data: profile }, appointments] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, timezone")
      .eq("id", id)
      .maybeSingle<{ full_name: string | null; timezone: string | null }>(),
    loadClientAppointmentsForStaff(supabase, id, null),
  ]);
  if (!profile) notFound();

  const name = profile.full_name?.trim() || t(lang, "dash.clientFallback");
  const nowMs = requestTimeMs();
  const upcoming = appointments
    .filter((appointment) => isLive(appointment, nowMs))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const history = appointments
    .filter((appointment) => !isLive(appointment, nowMs))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "schedule.eyebrow")}
        title={t(lang, "view.scheduleTitle")}
      />
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t(lang, "view.scheduleBody", { name })}
      </p>

      <AppointmentSection
        id="view-upcoming"
        title={t(lang, "view.upcoming")}
        appointments={upcoming}
        storedTimeZone={profile.timezone}
        lang={lang}
        emptyTitle={t(lang, "schedule.noNextTitle")}
        emptyBody={t(lang, "schedule.noNextBody")}
      />
      <AppointmentSection
        id="view-history"
        title={t(lang, "schedule.historyTitle")}
        appointments={history}
        storedTimeZone={profile.timezone}
        lang={lang}
        emptyTitle={t(lang, "schedule.noHistoryTitle")}
        emptyBody={t(lang, "schedule.noHistoryBody")}
      />
    </main>
  );
}

/** One stable clock read for the whole server render. */
function requestTimeMs(): number {
  return Date.now();
}

/** Still active and not yet ended: the same test the client's own schedule applies. */
function isLive(appointment: ClientAppointment, nowMs: number): boolean {
  return (
    isActiveAppointmentStatus(appointment.status) &&
    Date.parse(appointment.starts_at) + appointment.duration_min * 60_000 > nowMs
  );
}

function AppointmentSection({
  id,
  title,
  appointments,
  storedTimeZone,
  lang,
  emptyTitle,
  emptyBody,
}: {
  id: string;
  title: string;
  appointments: ClientAppointment[];
  storedTimeZone: string | null;
  lang: Lang;
  emptyTitle: string;
  emptyBody: string;
}) {
  const locale = lang === "tr" ? "tr-TR" : "en-GB";

  return (
    <section aria-labelledby={id} className="mt-8 min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 id={id} className="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-pill px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
          {appointments.length}
        </span>
      </div>

      {appointments.length === 0 ? (
        <DashboardEmptyState compact title={emptyTitle} body={emptyBody} />
      ) : (
        <ul className="grid min-w-0 gap-3 md:grid-cols-2">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="min-w-0 rounded-2xl border border-border bg-surface/70 p-5 shadow-soft"
            >
              <AppointmentLocalTime
                startsAt={appointment.starts_at}
                storedTimeZone={storedTimeZone}
                locale={locale}
                unavailableLabel={t(lang, "profile.timezoneUnset")}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-tint px-2.5 py-1 text-brand text-xs font-semibold">
                  {t(lang, `schedule.status.${appointment.status}`)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {t(lang, "schedule.durationMinutes", { n: appointment.duration_min })}
                </span>
              </div>
              {appointment.agenda && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {appointment.agenda}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
