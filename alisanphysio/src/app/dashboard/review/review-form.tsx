"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import { submitReview } from "./actions";

export type ReviewExercise = { id: string; name: string };
export type ReviewDay = { title: string | null; exercises: ReviewExercise[] };
export type ReviewProgram = { id: string; title: string; days: ReviewDay[] };

const card = "rounded-2xl border border-border bg-surface/60 p-6 shadow-soft sm:p-7";
const heading = "font-display text-lg font-bold text-foreground";
const checkboxRow =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground transition hover:bg-pill/50";
const checkbox = "h-4 w-4 flex-none accent-brand";
const primaryBtn =
  "rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-60";

export default function ReviewForm({
  programId,
  maxDays,
  programs,
  initialDays,
  initialDone,
  initialHard,
  initialNote,
  isEdit,
}: {
  programId: string;
  maxDays: number;
  programs: ReviewProgram[];
  initialDays: string;
  initialDone: string[];
  initialHard: string[];
  initialNote: string;
  isEdit: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [hard, setHard] = useState<Set<string>>(new Set(initialHard));
  const [note, setNote] = useState(initialNote);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { programTitle, exerciseName } = useMemo(() => {
    const pt = new Map<string, string>();
    const en = new Map<string, string>();
    for (const p of programs) {
      pt.set(p.id, p.title);
      for (const d of p.days) for (const e of d.exercises) en.set(e.id, e.name);
    }
    return { programTitle: pt, exerciseName: en };
  }, [programs]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await submitReview({
      programId,
      daysAttended: days,
      programsDone: [...done].map((id) => ({ id, title: programTitle.get(id) ?? "" })),
      hardExercises: [...hard].map((id) => ({ id, name: exerciseName.get(id) ?? "" })),
      note,
    });
    if (res.ok) {
      toast(t("toast.reviewSubmitted"));
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={isEdit || pending} className="min-w-0 space-y-6">
      {/* Days attended */}
      <section className={card}>
        <label htmlFor="rv-days" className="block text-sm font-medium text-foreground">
          {t("review.daysAttended")}
        </label>
        <input
          id="rv-days"
          type="number"
          inputMode="numeric"
          min="0"
          max={maxDays}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="mt-2 w-24 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          placeholder="0"
        />
      </section>

      {/* Programs done */}
      <section className={card}>
        <h2 className={heading}>{t("review.programsDone")}</h2>
        <div className="mt-3 space-y-1">
          {programs.map((p) => (
            <label key={p.id} className={checkboxRow}>
              <input
                type="checkbox"
                className={checkbox}
                checked={done.has(p.id)}
                onChange={() => toggle(done, setDone, p.id)}
              />
              <span className="font-medium">{p.title}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Hard exercises (from the actual program), grouped by day */}
      <section className={card}>
        <h2 className={heading}>{t("review.hardExercises")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("review.hardHint")}</p>
        <div className="mt-4 space-y-5">
          {programs.map((p) => {
            const grouped =
              p.days.length > 1 || p.days.some((d) => (d.title ?? "").trim() !== "");
            return (
              <div key={p.id}>
                {programs.length > 1 && (
                  <p className="mb-2 text-sm font-semibold text-foreground">{p.title}</p>
                )}
                <div className="space-y-3">
                  {p.days.map((d, di) => (
                    <div key={di}>
                      {grouped && (
                        <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {(d.title ?? "").trim() || t("prog.day", { n: di + 1 })}
                        </p>
                      )}
                      <div className="grid gap-1 sm:grid-cols-2">
                        {d.exercises.map((ex) => (
                          <label key={ex.id} className={checkboxRow}>
                            <input
                              type="checkbox"
                              className={checkbox}
                              checked={hard.has(ex.id)}
                              onChange={() => toggle(hard, setHard, ex.id)}
                            />
                            <span>{ex.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Note */}
      <section className={card}>
        <label htmlFor="rv-note" className="block text-sm font-medium text-foreground">
          {t("review.note")}
        </label>
        <textarea
          id="rv-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("review.notePlaceholder")}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
        />
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {!isEdit && <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending
            ? t("common.saving")
            : isEdit
              ? t("review.update")
              : t("review.submit")}
        </button>
      </div>}
      </fieldset>
    </form>
  );
}
