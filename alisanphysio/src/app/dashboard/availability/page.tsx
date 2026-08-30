import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import {
  loadCoachSettings,
  loadOpenAvailabilitySlots,
  loadOwnAppointments,
  loadOwnClientProposals,
} from "@/lib/scheduling-data";
import {
  canShowMeetingUrl,
  isValidTimeZone,
  localDateRangeToUtc,
  zonedDateTimeParts,
} from "@/lib/scheduling";
import { createClient } from "@/lib/supabase/server";
import DashboardSectionIntro from "@/components/dashboard-section-intro";
import ClientScheduleView from "./client-schedule-view";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "schedule.metaTitle")} · ${BRAND_NAME}` };
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [supabase, lang, query] = await Promise.all([
    createClient(),
    getLang(),
    searchParams,
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, settings] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle<{ timezone: string | null }>(),
    loadCoachSettings(supabase),
  ]);
  const profileTimeZone =
    profile?.timezone && isValidTimeZone(profile.timezone)
      ? profile.timezone
      : null;
  const fallbackTimeZone =
    settings?.timezone && isValidTimeZone(settings.timezone)
      ? settings.timezone
      : "UTC";
  const queryTimeZone = profileTimeZone ?? fallbackTimeZone;
  const generatedAt = new Date().toISOString();
  const currentMonth = zonedDateTimeParts(generatedAt, queryTimeZone).date.slice(
    0,
    7,
  );
  const requestedMonth = validMonth(query.month);
  const month = requestedMonth ?? currentMonth;
  const firstDate = `${month}-01`;
  const endDateExclusive = nextMonth(month);
  const range = localDateRangeToUtc(firstDate, endDateExclusive, queryTimeZone);
  // Before a browser-detected zone has been saved, the server cannot know the
  // viewer's exact calendar boundary. A two-day guard on both sides covers the
  // full IANA offset spread; the client then groups only dates in `month`.
  const slotRange = profileTimeZone
    ? range
    : {
        startsAt: new Date(Date.parse(range.startsAt) - 2 * 86_400_000).toISOString(),
        endsAt: new Date(Date.parse(range.endsAt) + 2 * 86_400_000).toISOString(),
      };

  const [appointments, proposals, slots] = await Promise.all([
    loadOwnAppointments(supabase, user.id),
    loadOwnClientProposals(supabase, user.id),
    settings?.scheduling_mode === "coach_slots"
      ? loadOpenAvailabilitySlots(supabase, slotRange)
      : Promise.resolve([]),
  ]);
  // Defense in depth: the migration RPC already masks client meeting URLs, but
  // never serialize one unless this render is inside the permitted window.
  const clientAppointments = appointments.map((appointment) => ({
    ...appointment,
    meeting_url: canShowMeetingUrl(appointment, generatedAt)
      ? appointment.meeting_url
      : null,
  }));
  const locale = lang === "tr" ? "tr-TR" : "en-GB";

  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-4xl">
      <DashboardSectionIntro
        eyebrow={t(lang, "schedule.eyebrow")}
        title={t(lang, "schedule.clientTitle")}
        body={t(lang, "schedule.clientBody")}
      />
      <div className="mt-7">
        <ClientScheduleView
          key={`${settings?.scheduling_mode ?? "coach_slots"}:${month}`}
          lang={lang}
          mode={settings?.scheduling_mode ?? "coach_slots"}
          profileTimeZone={profileTimeZone}
          fallbackTimeZone={fallbackTimeZone}
          month={month}
          monthWasRequested={Boolean(requestedMonth)}
          monthLabel={formatMonthLabel(month, locale)}
          weekdayLabels={weekdayLabels(locale)}
          generatedAt={generatedAt}
          appointments={clientAppointments}
          slots={slots}
          proposals={proposals}
        />
      </div>
    </main>
  );
}

function validMonth(value: string | undefined): string | null {
  if (!value) return null;
  const match = MONTH_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  // Keep calendar arithmetic inside the four-digit range accepted by the
  // wall-clock helpers, including the following month's exclusive boundary.
  return year >= 100 && year <= 9998 && month >= 1 && month <= 12
    ? value
    : null;
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, monthNumber, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-01`;
}

function formatMonthLabel(month: string, locale: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function weekdayLabels(locale: string): string[] {
  const monday = Date.UTC(2026, 0, 5);
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    }).format(new Date(monday + index * 86_400_000)),
  );
}
