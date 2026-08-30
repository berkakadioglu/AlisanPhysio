import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin-auth";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { mondayOfISO } from "@/lib/program-dates";
import {
  addLocalDays,
  localDateRangeToUtc,
  zonedDateTimeParts,
} from "@/lib/scheduling";
import {
  loadCoachSettings,
  loadStaffSchedulingData,
} from "@/lib/scheduling-data";
import type { CoachSettings } from "@/lib/types";
import AdminHeader from "../admin-header";
import SchedulingManager, {
  type SchedulingClientOption,
} from "./scheduling-manager";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, "schedule.metaTitle")} · ${BRAND_NAME}` };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_SETTINGS: CoachSettings = {
  scheduling_mode: "coach_slots",
  default_duration_min: 45,
  timezone: "Europe/Istanbul",
};

function requestInstant(): string {
  return new Date().toISOString();
}

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ supabase }, lang, params] = await Promise.all([
    requireStaff(),
    getLang(),
    searchParams,
  ]);
  const settings = (await loadCoachSettings(supabase)) ?? DEFAULT_SETTINGS;
  const todayInCoachZone = zonedDateTimeParts(
    requestInstant(),
    settings.timezone,
  ).date;
  const requestedWeek =
    params.week && DATE_RE.test(params.week) ? params.week : todayInCoachZone;
  const weekStart = mondayOfISO(requestedWeek);
  const weekEndExclusive = addLocalDays(weekStart, 7);
  const range = localDateRangeToUtc(
    weekStart,
    weekEndExclusive,
    settings.timezone,
  );

  const [{ data: profileRows }, schedule] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, timezone")
      .eq("role", "client")
      .order("full_name", { ascending: true })
      .returns<SchedulingClientOption[]>(),
    loadStaffSchedulingData(supabase, range),
  ]);

  return (
    <div className="min-h-screen">
      <AdminHeader container="max-w-7xl" />
      <main className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <SchedulingManager
          lang={lang}
          weekStart={weekStart}
          settings={schedule.settings ?? settings}
          appointments={schedule.appointments}
          slots={schedule.slots}
          pendingAppointments={schedule.pendingAppointments}
          pendingProposals={schedule.pendingProposals}
          clients={profileRows ?? []}
        />
      </main>
    </div>
  );
}
