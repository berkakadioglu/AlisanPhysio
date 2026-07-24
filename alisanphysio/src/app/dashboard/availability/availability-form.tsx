"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { formatDayWithWeekday, type Lang } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { saveAvailability } from "./actions";

export type DayInitial = {
  dayDate: string;
  available: boolean;
  timeFrom: string;
  timeTo: string;
  note: string;
};

const primaryBtn =
  "rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60";
const timeInput =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";
const noteInput =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function AvailabilityForm({
  lang,
  requestId,
  days: initialDays,
  alreadySubmitted,
}: {
  lang: Lang;
  requestId: string;
  days: DayInitial[];
  alreadySubmitted: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [days, setDays] = useState<DayInitial[]>(initialDays);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  function update(i: number, patch: Partial<DayInitial>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    setSubmitted(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await saveAvailability({
      requestId,
      slots: days
        .filter((d) => d.available)
        .map((d) => ({
          dayDate: d.dayDate,
          timeFrom: d.timeFrom,
          timeTo: d.timeTo,
          note: d.note,
        })),
    });
    if (res.ok) {
      toast(t("toast.availabilitySaved"));
      setSubmitted(true);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {submitted && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-brand/30 bg-brand-tint px-4 py-3">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-solid text-white">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand">
              {t("avail.submittedBadge")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("avail.submittedHint")}
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t("avail.clientIntro")}</p>

      <div className="space-y-3">
        {days.map((d, i) => (
          <div
            key={d.dayDate}
            className={`rounded-2xl border p-4 shadow-soft transition ${
              d.available
                ? "border-brand/30 bg-surface"
                : "border-border bg-surface/50"
            }`}
          >
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 flex-none accent-brand"
                checked={d.available}
                onChange={(e) => update(i, { available: e.target.checked })}
              />
              <span className="font-semibold text-foreground">
                {formatDayWithWeekday(d.dayDate, lang)}
              </span>
              {!d.available && (
                <span className="text-xs text-subtle-foreground">
                  {t("avail.available")}
                </span>
              )}
            </label>

            {d.available && (
              <div className="mt-3 space-y-3 pl-7">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("avail.from")}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={d.timeFrom}
                      onChange={(e) => update(i, { timeFrom: e.target.value })}
                      placeholder={t("avail.timePlaceholderFrom")}
                      className={timeInput}
                    />
                  </div>
                  <span className="pb-2.5 text-muted-foreground">–</span>
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("avail.to")}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={d.timeTo}
                      onChange={(e) => update(i, { timeTo: e.target.value })}
                      placeholder={t("avail.timePlaceholderTo")}
                      className={timeInput}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("avail.dayNote")}
                  </label>
                  <input
                    type="text"
                    value={d.note}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder={t("avail.dayNotePlaceholder")}
                    className={noteInput}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending
            ? t("common.saving")
            : submitted
              ? t("avail.update")
              : t("avail.submit")}
        </button>
      </div>
    </form>
  );
}
