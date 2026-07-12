"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Complaint, Measurement } from "@/lib/types";
import type { Membership } from "@/lib/membership";
import { formatDay } from "@/lib/i18n";
import { bmiCategory, computeBmi, type BmiCategory } from "@/lib/bmi";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import MembershipBadge from "@/components/membership-badge";
import MeasurementChart from "./measurement-chart";
import {
  addComplaint,
  addMeasurement,
  changeOwnPassword,
  deleteComplaint,
  deleteMeasurement,
  updatePersonalInfo,
} from "./actions";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";
const labelClass = "block text-sm font-medium text-foreground";
const cardClass = "rounded-2xl border border-border bg-surface/60 p-6 shadow-soft sm:p-7";
const primaryBtn =
  "rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60";
const errorClass =
  "rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger";

export interface ProfileData {
  id: string;
  full_name: string | null;
  height_cm: number | null;
  membership: Membership | null;
  membership_end_date: string | null;
}

export default function ProfileView({
  profile,
  email,
  measurements,
  complaints,
  readOnly = false,
}: {
  profile: ProfileData;
  email: string;
  measurements: Measurement[];
  complaints: Complaint[];
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PersonalInfoSection profile={profile} email={email} readOnly={readOnly} />
      {!readOnly && <ChangePasswordSection />}
      <MeasurementsSection
        measurements={measurements}
        heightCm={profile.height_cm}
        readOnly={readOnly}
      />
      <ComplaintsSection complaints={complaints} readOnly={readOnly} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Personal information
// ---------------------------------------------------------------------------
function PersonalInfoSection({
  profile,
  email,
  readOnly,
}: {
  profile: ProfileData;
  email: string;
  readOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(profile.full_name ?? "");
  const [height, setHeight] = useState(
    profile.height_cm != null ? String(profile.height_cm) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await updatePersonalInfo({ fullName: name, height });
    if (res.ok) {
      toast(t("toast.profileSaved"));
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <section className={cardClass}>
      <h2 className="font-display text-xl font-bold text-foreground">
        {t("profile.personalHeading")}
      </h2>

      {readOnly ? (
        <dl className="mt-4 space-y-3 text-sm">
          <Row label={t("profile.fullName")} value={profile.full_name?.trim() || "—"} />
          <Row
            label={t("profile.height")}
            value={
              profile.height_cm != null
                ? `${profile.height_cm} cm`
                : t("profile.heightUnset")
            }
          />
          <Row label={t("profile.email")} value={email || "—"} />
        </dl>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pf-name" className={labelClass}>
              {t("profile.fullName")}
            </label>
            <input
              id="pf-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Deniz Aydın"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pf-height" className={labelClass}>
              {t("profile.height")}
            </label>
            <input
              id="pf-height"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="50"
              max="260"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={`${inputClass} max-w-40`}
              placeholder="170"
            />
            <p className="text-xs text-subtle-foreground">{t("profile.heightHint")}</p>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>{t("profile.email")}</label>
            <input
              type="text"
              value={email}
              readOnly
              disabled
              className={`${inputClass} cursor-not-allowed bg-pill/60 text-muted-foreground`}
            />
            <p className="text-xs text-subtle-foreground">
              {t("profile.emailReadonlyHint")}
            </p>
          </div>

          {error && (
            <p role="alert" className={errorClass}>
              {error}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? t("common.saving") : t("profile.savePersonal")}
            </button>
          </div>
        </form>
      )}

      {/* Membership — admin-set, always read-only here. Client sees it near
          their details; the admin sets it from the Manage modal. */}
      {(profile.membership || readOnly) && (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="text-sm font-medium text-muted-foreground">
            {readOnly ? t("membership.label") : t("membership.your")}
          </span>
          {profile.membership ? (
            <span className="flex flex-wrap items-center justify-end gap-2">
              <MembershipBadge membership={profile.membership} />
              {(profile.membership_end_date || readOnly) && (
                <span className="text-xs text-subtle-foreground">
                  {profile.membership_end_date
                    ? t("membership.until", {
                        date: formatDay(profile.membership_end_date, lang),
                      })
                    : t("membership.noExpiry")}
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-subtle-foreground">
              {t("membership.none")}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) Change password (client-only; never shown read-only)
// ---------------------------------------------------------------------------
function ChangePasswordSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("reset.tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setPending(true);
    const res = await changeOwnPassword({ password });
    if (res.ok) {
      toast(t("toast.passwordUpdated"));
      setPassword("");
      setConfirm("");
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <section className={cardClass}>
      <h2 className="font-display text-xl font-bold text-foreground">
        {t("profile.passwordHeading")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile.passwordSub")}</p>

      <form onSubmit={submit} autoComplete="off" className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="pf-pw" className={labelClass}>
              {t("profile.newPassword")}
            </label>
            <input
              id="pf-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pf-pw2" className={labelClass}>
              {t("profile.confirmPassword")}
            </label>
            <input
              id="pf-pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className={errorClass}>
            {error}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending ? t("reset.updating") : t("profile.updatePassword")}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3) Weekly measurements — form + table + chart
// ---------------------------------------------------------------------------
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function bmiOf(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

function MeasurementsSection({
  measurements,
  heightCm,
  readOnly,
}: {
  measurements: Measurement[];
  heightCm: number | null;
  readOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [metric, setMetric] = useState<"weight" | "bmi">("weight");
  const hasHeight = heightCm != null && heightCm > 0;

  // Add-measurement form state
  const [date, setDate] = useState(localToday());
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [arm, setArm] = useState("");
  const [chest, setChest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Weight is the only required field; circumferences may be left blank.
    if (weight.trim() === "") {
      setError(t("err.weightRequired"));
      return;
    }
    setPending(true);
    const res = await addMeasurement({
      measuredOn: date,
      weight,
      waist,
      hip,
      arm,
      chest,
    });
    if (res.ok) {
      toast(t("toast.measurementAdded"));
      setWeight("");
      setWaist("");
      setHip("");
      setArm("");
      setChest("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  async function remove(id: string) {
    if (!window.confirm(t("profile.confirmDeleteMeasurement"))) return;
    setDeletingId(id);
    const res = await deleteMeasurement({ id });
    if (res.ok) {
      toast(t("toast.measurementDeleted"));
      router.refresh();
    }
    setDeletingId(null);
  }

  // Chart points: chronological, weighted rows only.
  const chartPoints = [...measurements]
    .filter((m) => m.weight_kg != null)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .map((m) => ({
      date: m.measured_on,
      value:
        metric === "bmi" && hasHeight
          ? bmiOf(m.weight_kg as number, heightCm as number)
          : (m.weight_kg as number),
    }));

  const fmtDate = (iso: string) => {
    const [yy, mm, dd] = iso.split("-").map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString(
      lang === "tr" ? "tr-TR" : "en-US",
      { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
    );
  };
  const num = (v: number | null) =>
    v == null
      ? "—"
      : new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
          maximumFractionDigits: 1,
        }).format(v);

  const numField = (
    id: string,
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    mark?: "required" | "optional",
  ) => (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
      >
        <span>{label}</span>
        {mark === "optional" && (
          <span className="font-normal text-subtle-foreground">
            ({t("profile.optional")})
          </span>
        )}
        {mark === "required" && (
          <span className="font-semibold text-brand" aria-hidden>
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => setter(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
    </div>
  );

  const chartUnit = metric === "bmi" ? t("profile.chartBmi") : t("profile.chartKg");

  // Most-recent-BMI status (measurements arrive newest-first).
  const latestWeighted = measurements.find((m) => m.weight_kg != null);
  const latestBmi = hasHeight
    ? computeBmi(latestWeighted?.weight_kg ?? null, heightCm)
    : null;
  const latestCategory: BmiCategory | null =
    latestBmi != null ? bmiCategory(latestBmi) : null;

  return (
    <section className={cardClass}>
      <h2 className="font-display text-xl font-bold text-foreground">
        {t("profile.measurementsHeading")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("profile.measurementsSub")}
      </p>

      {/* Add form (client only) */}
      {!readOnly && (
        <form
          onSubmit={submit}
          className="mt-5 rounded-xl border border-border bg-background/60 p-4"
        >
          <p className="mb-3 text-sm font-semibold text-foreground">
            {t("profile.addMeasurement")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1.5">
              <label
                htmlFor="pf-date"
                className="block text-xs font-medium text-muted-foreground"
              >
                {t("profile.date")}
              </label>
              <input
                id="pf-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            {numField("pf-weight", t("profile.weight"), weight, setWeight, "72", "required")}
            {numField("pf-waist", t("profile.waist"), waist, setWaist, "80", "optional")}
            {numField("pf-hip", t("profile.hip"), hip, setHip, "95", "optional")}
            {numField("pf-arm", t("profile.arm"), arm, setArm, "32", "optional")}
            {numField("pf-chest", t("profile.chest"), chest, setChest, "98", "optional")}
          </div>

          {error && (
            <p role="alert" className={`${errorClass} mt-3`}>
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      )}

      {/* BMI classification of the most recent measurement (WHO categories) */}
      {latestBmi != null && latestCategory && (
        <div className="mt-6">
          <BmiStatus bmi={latestBmi} category={latestCategory} />
        </div>
      )}

      {/* Chart */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1">
            <MetricTab
              active={metric === "weight"}
              onClick={() => setMetric("weight")}
              label={t("profile.chartWeight")}
            />
            <MetricTab
              active={metric === "bmi"}
              disabled={!hasHeight}
              onClick={() => hasHeight && setMetric("bmi")}
              label={t("profile.chartBmi")}
            />
          </div>
        </div>

        {metric === "bmi" && !hasHeight ? (
          <EmptyChart
            text={readOnly ? t("profile.bmiNeedsHeightReadonly") : t("profile.bmiNeedsHeight")}
          />
        ) : chartPoints.length > 0 ? (
          <MeasurementChart points={chartPoints} unit={chartUnit} lang={lang} />
        ) : (
          <EmptyChart
            text={readOnly ? t("profile.chartEmptyReadonly") : t("profile.chartEmpty")}
          />
        )}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        {measurements.length > 0 ? (
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3">{t("profile.date")}</th>
                <th className="py-2.5 pr-3 text-right">{t("profile.colWeight")}</th>
                <th className="py-2.5 pr-3 text-right">{t("profile.colWaist")}</th>
                <th className="py-2.5 pr-3 text-right">{t("profile.colHip")}</th>
                <th className="py-2.5 pr-3 text-right">{t("profile.colArm")}</th>
                <th className="py-2.5 pr-3 text-right">{t("profile.colChest")}</th>
                {!readOnly && <th className="py-2.5" aria-hidden />}
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">
                    {fmtDate(m.measured_on)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                    {num(m.weight_kg)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {num(m.waist_cm)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {num(m.hip_cm)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {num(m.arm_cm)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {num(m.chest_cm)}
                  </td>
                  {!readOnly && (
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        disabled={deletingId === m.id}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-danger transition hover:bg-danger-tint disabled:opacity-50"
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-subtle-foreground">
            {readOnly
              ? t("profile.noMeasurementsReadonly")
              : t("profile.noMeasurements")}
          </p>
        )}
      </div>
    </section>
  );
}

function MetricTab({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-brand-solid text-white shadow-sm"
          : disabled
            ? "cursor-not-allowed text-subtle-foreground/60"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 px-5 text-center text-sm text-subtle-foreground">
      {text}
    </div>
  );
}

// WHO BMI category → calm, muted palette that harmonizes with the theme
// (blue / green / amber / soft red — informational, never alarming). Colors
// resolve to CSS variables (see globals.css) so they re-theme in dark mode.
const BMI_STYLE: Record<BmiCategory, { bg: string; fg: string; border: string }> = {
  underweight: {
    bg: "var(--bmi-underweight-bg)",
    fg: "var(--bmi-underweight-fg)",
    border: "var(--bmi-underweight-border)",
  },
  normal: {
    bg: "var(--bmi-normal-bg)",
    fg: "var(--bmi-normal-fg)",
    border: "var(--bmi-normal-border)",
  },
  overweight: {
    bg: "var(--bmi-overweight-bg)",
    fg: "var(--bmi-overweight-fg)",
    border: "var(--bmi-overweight-border)",
  },
  obese: {
    bg: "var(--bmi-obese-bg)",
    fg: "var(--bmi-obese-fg)",
    border: "var(--bmi-obese-border)",
  },
};

function BmiStatus({
  bmi,
  category,
}: {
  bmi: number;
  category: BmiCategory;
}) {
  const { t, lang } = useI18n();
  const s = BMI_STYLE[category];
  const value = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 1,
  }).format(bmi);
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{ backgroundColor: s.bg, borderColor: s.border }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: s.fg, color: s.bg }}
        >
          {t(`bmi.${category}`)}
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: s.fg }}
        >
          {t("bmi.value", { value })}
        </span>
        <span className="text-xs text-subtle-foreground">· {t("bmi.basedOn")}</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: s.fg }}>
        {t(`bmi.note.${category}`)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4) Complaints / notes
// ---------------------------------------------------------------------------
function ComplaintsSection({
  complaints,
  readOnly,
}: {
  complaints: Complaint[];
  readOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await addComplaint({ body });
    if (res.ok) {
      toast(t("toast.noteAdded"));
      setBody("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  async function remove(id: string) {
    if (!window.confirm(t("profile.confirmDeleteComplaint"))) return;
    setDeletingId(id);
    const res = await deleteComplaint({ id });
    if (res.ok) {
      toast(t("toast.noteDeleted"));
      router.refresh();
    }
    setDeletingId(null);
  }

  const fmtStamp = (iso: string) =>
    new Date(iso).toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className={cardClass}>
      <h2 className="font-display text-xl font-bold text-foreground">
        {t("profile.complaintsHeading")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile.complaintsSub")}</p>

      {!readOnly && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder={t("profile.complaintPlaceholder")}
          />
          {error && (
            <p role="alert" className={errorClass}>
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? t("common.saving") : t("profile.addNote")}
            </button>
          </div>
        </form>
      )}

      <ul className="mt-5 space-y-3">
        {complaints.length > 0 ? (
          complaints.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-border bg-background/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <time className="text-xs font-medium text-subtle-foreground">
                  {fmtStamp(c.created_at)}
                </time>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={deletingId === c.id}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-danger transition hover:bg-danger-tint disabled:opacity-50"
                  >
                    {t("common.delete")}
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                {c.body}
              </p>
            </li>
          ))
        ) : (
          <li className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-subtle-foreground">
            {readOnly ? t("profile.noComplaintsReadonly") : t("profile.noComplaints")}
          </li>
        )}
      </ul>
    </section>
  );
}
