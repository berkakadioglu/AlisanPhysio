"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronDown, Users } from "lucide-react";
import {
  availDaysCount,
  formatDayWithWeekday,
  formatWeekRange,
  weekLabel,
  type Lang,
} from "@/lib/i18n";
import { listWeekMondays } from "@/lib/program-dates";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { sendAvailabilityRequests } from "./actions";

export type AvailClient = {
  id: string;
  name: string | null;
  email: string;
  active: boolean;
};

export type AvailSlot = {
  dayDate: string;
  timeFrom: string | null;
  timeTo: string | null;
  note: string | null;
};

export type AvailResponse = {
  clientId: string;
  name: string | null;
  email: string;
  createdAt: string;
  slots: AvailSlot[];
};

const card = "rounded-2xl border border-border bg-surface/60 p-6 shadow-soft sm:p-7";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-pill disabled:cursor-not-allowed disabled:opacity-60";
const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function AvailabilityManager({
  lang,
  weekStart,
  clients,
  responses,
}: {
  lang: Lang;
  weekStart: string;
  clients: AvailClient[];
  responses: AvailResponse[];
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [pending, setPending] = useState<"all" | "selected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const weekOptions = useMemo(() => {
    const set = new Set(listWeekMondays(3, 8));
    set.add(weekStart);
    return [...set].sort();
  }, [weekStart]);

  const activeCount = useMemo(
    () => clients.filter((c) => c.active).length,
    [clients],
  );

  function changeWeek(next: string) {
    router.push(`/admin/availability?week=${next}`);
  }

  function toggleClient(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function send(scope: "all" | "selected") {
    setError(null);
    setPending(scope);
    const res = await sendAvailabilityRequests({
      weekStart,
      scope,
      clientIds: scope === "selected" ? [...selected] : undefined,
    });
    if (res.ok) {
      toast(t("toast.availabilitySent"));
      setSelected(new Set());
      setPickerOpen(false);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(null);
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
            <CalendarClock className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {t("avail.staffHeading")}
          </h1>
        </div>
        <p className="mt-2 text-base text-muted-foreground">
          {t("avail.staffSubtitle")}
        </p>
      </header>

      {/* Week selector (drives both sending and the responses view) */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {t("avail.week")}
        </label>
        <select
          value={weekStart}
          onChange={(e) => changeWeek(e.target.value)}
          className={`${inputClass} max-w-md`}
        >
          {weekOptions.map((m) => (
            <option key={m} value={m}>
              {weekLabel(m, lang)}
            </option>
          ))}
        </select>
      </div>

      {/* Send a request */}
      <section className={card}>
        <h2 className="font-display text-lg font-bold text-foreground">
          {t("avail.sendHeading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("avail.sendSubtitle")}
        </p>

        {clients.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border bg-surface/50 px-4 py-6 text-center text-sm text-subtle-foreground">
            {t("avail.noActiveClients")}
          </p>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={primaryBtn}
                disabled={pending !== null || activeCount === 0}
                onClick={() => send("all")}
              >
                <Users className="h-4 w-4" aria-hidden />
                {pending === "all"
                  ? t("avail.sending")
                  : t("avail.sendAllActiveCount", { n: activeCount })}
              </button>

              <button
                type="button"
                className={ghostBtn}
                onClick={() => setPickerOpen((o) => !o)}
                aria-expanded={pickerOpen}
              >
                {t("avail.selectClients")}
                <ChevronDown
                  className={`h-4 w-4 transition ${pickerOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            {pickerOpen && (
              <div className="mt-4 rounded-xl border border-border bg-surface/70 p-3">
                <p className="px-1 pb-2 text-xs text-subtle-foreground">
                  {t("avail.selectClientsHint")}
                </p>
                <ul className="max-h-72 space-y-0.5 overflow-y-auto">
                  {clients.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-pill/60">
                        <input
                          type="checkbox"
                          className="h-4 w-4 flex-none accent-brand"
                          checked={selected.has(c.id)}
                          onChange={() => toggleClient(c.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {c.name || c.email}
                          </span>
                          {c.name && (
                            <span className="block truncate text-xs text-subtle-foreground">
                              {c.email}
                            </span>
                          )}
                        </span>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            c.active
                              ? "bg-brand-tint text-brand"
                              : "bg-pill text-muted-foreground"
                          }`}
                        >
                          {c.active ? t("avail.activeBadge") : t("avail.inactiveBadge")}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className={primaryBtn}
                    disabled={pending !== null || selected.size === 0}
                    onClick={() => send("selected")}
                  >
                    {pending === "selected"
                      ? t("avail.sending")
                      : t("avail.sendSelectedCount", { n: selected.size })}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </section>

      {/* Responses */}
      <section>
        <h2 className="font-display text-lg font-bold text-foreground">
          {t("avail.responsesHeading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("avail.responsesSubtitle", { range: formatWeekRange(weekStart, lang) })}
        </p>

        {responses.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center text-sm text-subtle-foreground">
            {t("avail.noRequests")}
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {responses.map((r) => {
              const responded = r.slots.length > 0;
              return (
                <li
                  key={r.clientId}
                  className="rounded-2xl border border-border bg-surface/60 p-5 shadow-soft"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {r.name || r.email}
                      </p>
                      {r.name && (
                        <p className="truncate text-xs text-subtle-foreground">
                          {r.email}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        responded
                          ? "bg-brand-tint text-brand"
                          : "bg-[var(--warning-tint)] text-[var(--warning)]"
                      }`}
                    >
                      {responded ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          {availDaysCount(lang, r.slots.length)}
                        </>
                      ) : (
                        t("avail.notResponded")
                      )}
                    </span>
                  </div>

                  {responded && (
                    <ul className="mt-4 space-y-2 border-t border-border/60 pt-4">
                      {r.slots.map((s, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                          <span className="min-w-32 font-medium text-foreground">
                            {formatDayWithWeekday(s.dayDate, lang)}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatRange(s.timeFrom, s.timeTo)}
                          </span>
                          {s.note && (
                            <span className="text-xs text-subtle-foreground">
                              — {s.note}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Render a free-form time range: "18:00 – 20:00", or a single end, or a dash. */
function formatRange(from: string | null, to: string | null): string {
  const f = from?.trim() || "";
  const tt = to?.trim() || "";
  if (f && tt) return `${f} – ${tt}`;
  return f || tt || "—";
}
