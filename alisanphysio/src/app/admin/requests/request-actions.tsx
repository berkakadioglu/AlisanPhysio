"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Save } from "lucide-react";
import {
  ASSESSMENT_STATUSES,
  type AssessmentStatus,
} from "@/lib/assessment";
import { t, type Lang } from "@/lib/i18n";
import { useToast } from "@/app/toast";
import {
  saveAssessmentAdminNote,
  updateAssessmentStatus,
} from "./actions";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

export default function RequestActions({
  id,
  email,
  initialStatus,
  initialNote,
  lang,
}: {
  id: string;
  email: string;
  initialStatus: AssessmentStatus;
  initialNote: string | null;
  lang: Lang;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState<"status" | "note" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast(t(lang, "requests.copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(t(lang, "requests.copyFailed"));
    }
  }

  async function saveStatus() {
    setPending("status");
    setError(null);
    try {
      const result = await updateAssessmentStatus({ id, status });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(t(lang, "requests.statusSaved"));
      router.refresh();
    } catch {
      setError(t(lang, "requests.saveError"));
    } finally {
      setPending(null);
    }
  }

  async function saveNote() {
    setPending("note");
    setError(null);
    try {
      const result = await saveAssessmentAdminNote({ id, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(t(lang, "requests.noteSaved"));
      router.refresh();
    } catch {
      setError(t(lang, "requests.saveError"));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/70 p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {t(lang, "requests.workflowHeading")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(lang, "requests.workflowSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={copyEmail}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-pill"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Clipboard className="h-4 w-4" aria-hidden />}
          {copied ? t(lang, "requests.copied") : t(lang, "requests.copyEmail")}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          <label htmlFor="request-status" className="block text-sm font-medium text-foreground">
            {t(lang, "requests.status")}
          </label>
          <select id="request-status" value={status} onChange={(event) => setStatus(event.target.value as AssessmentStatus)} className={inputClass}>
            {ASSESSMENT_STATUSES.map((item) => (
              <option key={item} value={item}>{t(lang, `requests.status.${item}`)}</option>
            ))}
          </select>
          <button type="button" onClick={saveStatus} disabled={pending !== null} className={`${primaryButton} mt-2 w-full`}>
            {pending === "status" ? t(lang, "requests.updating") : t(lang, "requests.updateStatus")}
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="request-admin-note" className="block text-sm font-medium text-foreground">
            {t(lang, "requests.adminNote")}
          </label>
          <textarea id="request-admin-note" rows={5} maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t(lang, "requests.adminNotePlaceholder")} className={`${inputClass} resize-y`} />
          <button type="button" onClick={saveNote} disabled={pending !== null} className={`${primaryButton} mt-2`}>
            <Save className="h-4 w-4" aria-hidden />
            {pending === "note" ? t(lang, "common.saving") : t(lang, "requests.saveNote")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
