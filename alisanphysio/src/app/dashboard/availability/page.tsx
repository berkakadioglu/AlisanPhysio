import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { formatWeekRange, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import {
  loadOwnRequests,
  pendingRequest,
  weekDays,
} from "@/lib/availability";
import { thisMondayISO } from "@/lib/program-dates";
import AppHeader from "../app-header";
import AvailabilityForm, { type DayInitial } from "./availability-form";

export const metadata: Metadata = {
  title: `Availability · ${BRAND_NAME}`,
};

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();
  const lang = await getLang();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The user's own requests (RLS scopes to client_id = auth.uid()).
  const requests = await loadOwnRequests(supabase, user.id);
  const { week } = await searchParams;

  // Choose which request to show: the one named in ?week=, else the most
  // relevant pending one, else the newest — else nothing to answer.
  const chosen =
    (week && WEEK_RE.test(week)
      ? requests.find((r) => r.week_start === week)
      : undefined) ??
    pendingRequest(requests, thisMondayISO()) ??
    requests[0] ??
    null;

  return (
    <div className="min-h-screen">
      <AppHeader container="max-w-3xl" />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-brand"
        >
          <span aria-hidden>←</span> {t(lang, "prog.back")}
        </Link>

        {!chosen ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
            <p className="font-display text-lg font-bold text-foreground">
              {t(lang, "avail.emptyTitle")}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t(lang, "avail.emptyBody")}
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
              {t(lang, "avail.clientHeading")}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {t(lang, "avail.clientSubtitle", {
                range: formatWeekRange(chosen.week_start, lang),
              })}
            </p>

            <div className="mt-8">
              <AvailabilityForm
                lang={lang}
                requestId={chosen.id}
                days={buildDays(chosen.week_start, chosen.slots)}
                alreadySubmitted={chosen.slots.length > 0}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** Build the 7-day editable model, pre-filling any already-submitted slots. */
function buildDays(
  weekStart: string,
  slots: { day_date: string; time_from: string | null; time_to: string | null; note: string | null }[],
): DayInitial[] {
  const byDay = new Map(slots.map((s) => [s.day_date, s]));
  return weekDays(weekStart).map((d) => {
    const s = byDay.get(d);
    return {
      dayDate: d,
      available: !!s,
      timeFrom: s?.time_from ?? "",
      timeTo: s?.time_to ?? "",
      note: s?.note ?? "",
    };
  });
}
