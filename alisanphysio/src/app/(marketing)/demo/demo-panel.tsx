"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  Dumbbell,
  Home,
  Info,
  MessageSquareText,
  Play,
  Sparkles,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/lib/i18n";
import {
  DEMO_DATA,
  type DemoExercise,
  type DemoProgrammeMonth,
  type DemoViewId,
} from "@/lib/demo-data";
import MeasurementChart from "@/app/dashboard/profile/measurement-chart";
import SectionIntro from "@/components/panel-section-intro";

type LocalizedText = Readonly<Record<Lang, string>>;
type DemoStatus = (typeof DEMO_DATA.schedule.days)[number]["status"];

const VIEW_ICONS: Record<(typeof DEMO_DATA.views)[number]["icon"], LucideIcon> = {
  home: Home,
  dumbbell: Dumbbell,
  apple: Apple,
  chart: BarChart3,
  calendar: CalendarDays,
};

const THUMBNAIL_TONE: Record<DemoExercise["tone"], string> = {
  forest: "bg-brand-solid text-white",
  sage: "bg-brand-tint text-brand",
  clay: "bg-[var(--warning-tint)] text-[var(--warning)]",
};

const STATUS_STYLE: Record<DemoStatus, string> = {
  booked: "border-brand/35 bg-brand-tint text-brand",
  available: "border-border bg-surface text-foreground",
  unavailable: "border-border bg-background/60 text-subtle-foreground",
};

const cardClass =
  "min-w-0 rounded-2xl border border-border bg-surface/70 shadow-soft";
const quietButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-brand/35 hover:bg-brand-tint hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-35";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function copy(lang: Lang, value: LocalizedText) {
  return value[lang];
}

function OverviewView({
  lang,
  onProgramme,
  onWriteAction,
}: {
  lang: Lang;
  onProgramme: () => void;
  onWriteAction: () => void;
}) {
  const data = DEMO_DATA.overview;

  return (
    <div>
      <header className="max-w-2xl">
        <h2 className="text-balance font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {copy(lang, data.greeting)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {copy(lang, data.intro)}
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {data.metrics.map((metric) => (
          <div
            key={metric.label.en}
            className="min-w-0 rounded-2xl border border-border bg-background/70 p-3.5 sm:p-4"
          >
            <dd className="break-words font-display text-xl font-extrabold tabular-nums text-foreground sm:text-2xl">
              {copy(lang, metric.value)}
            </dd>
            <dt className="mt-1 text-xs leading-snug text-muted-foreground">
              {copy(lang, metric.label)}
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        <article className={`${cardClass} flex flex-col p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {copy(lang, data.programmeEyebrow)}
              </p>
              <h3 className="mt-2 font-display text-xl font-bold text-foreground">
                {copy(lang, data.programmeTitle)}
              </h3>
            </div>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
              <Dumbbell className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
            {copy(lang, data.programmeBody)}
          </p>
          <button
            type="button"
            onClick={onProgramme}
            className="mt-5 inline-flex min-h-11 items-center gap-2 self-start rounded-full text-sm font-bold text-brand transition hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {copy(lang, data.openProgramme)}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </article>

        <article className={`${cardClass} p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {copy(lang, data.appointmentEyebrow)}
              </p>
              <h3 className="mt-2 font-display text-xl font-bold text-foreground">
                {copy(lang, data.appointmentTitle)}
              </h3>
            </div>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {copy(lang, data.appointmentTime)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy(lang, data.appointmentBody)}
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-brand/25 bg-brand-tint p-5 sm:p-6">
          <div className="flex items-center gap-2 text-brand">
            <MessageSquareText className="h-4 w-4" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.14em]">
              {copy(lang, data.coachNoteEyebrow)}
            </p>
          </div>
          <h3 className="mt-3 font-display text-lg font-bold text-foreground">
            {copy(lang, data.coachNoteTitle)}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy(lang, data.coachNoteBody)}
          </p>
        </article>

        <article className={`${cardClass} p-5 sm:p-6`}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
            {copy(lang, data.reviewEyebrow)}
          </p>
          <h3 className="mt-2 font-display text-lg font-bold text-foreground">
            {copy(lang, data.reviewTitle)}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy(lang, data.reviewBody)}
          </p>
          <button
            type="button"
            onClick={onWriteAction}
            className={`${primaryButton} mt-5 w-full sm:w-auto`}
          >
            {copy(lang, data.reviewAction)}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </article>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  lang,
  expanded,
  onToggle,
}: {
  exercise: DemoExercise;
  lang: Lang;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detailId = `demo-exercise-${exercise.id}`;
  const common = DEMO_DATA.common;

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-background/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
        aria-label={`${copy(lang, expanded ? common.closeExercise : common.openExercise)}: ${copy(lang, exercise.name)}`}
        className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-tint/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
      >
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${THUMBNAIL_TONE[exercise.tone]}`}>
          <Play className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-foreground">
            {copy(lang, exercise.name)}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {exercise.sets} {copy(lang, common.sets).toLocaleLowerCase(lang)} · {copy(lang, exercise.reps)}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-none text-muted-foreground transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div
          id={detailId}
          className="grid min-w-0 gap-4 border-t border-border p-4 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)] sm:p-5"
        >
          <div
            className={`relative isolate aspect-video min-w-0 overflow-hidden rounded-xl ${THUMBNAIL_TONE[exercise.tone]}`}
          >
            <span className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-current opacity-20" />
            <span className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-current opacity-10" />
            <span className="absolute left-4 top-4 text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
              {copy(lang, common.videoPreview)}
            </span>
            <Dumbbell className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2" aria-hidden />
            <span className="absolute inset-x-4 bottom-4 text-xs font-semibold">
              {copy(lang, common.designedThumbnail)}
            </span>
          </div>

          <div className="min-w-0">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [copy(lang, common.sets), exercise.sets],
                [copy(lang, common.reps), copy(lang, exercise.reps)],
                [copy(lang, common.tempo), copy(lang, exercise.tempo)],
                [copy(lang, common.rest), copy(lang, exercise.rest)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl bg-surface p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-subtle-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-xl border border-brand/20 bg-brand-tint p-3.5">
              <p className="text-xs font-bold text-brand">
                {copy(lang, common.notes)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/85">
                {copy(lang, exercise.cue)}
              </p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ProgrammeView({
  lang,
  month,
  monthIndex,
  openExerciseId,
  onPrevious,
  onNext,
  onExercise,
  onWriteAction,
}: {
  lang: Lang;
  month: DemoProgrammeMonth;
  monthIndex: number;
  openExerciseId: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onExercise: (id: string) => void;
  onWriteAction: () => void;
}) {
  const data = DEMO_DATA.programme;
  const common = DEMO_DATA.common;

  return (
    <div>
      <SectionIntro
        eyebrow={copy(lang, data.eyebrow)}
        title={copy(lang, data.title)}
        body={copy(lang, data.body)}
        action={
          <button type="button" onClick={onWriteAction} className={quietButton}>
            <Download className="h-4 w-4" aria-hidden />
            {copy(lang, data.downloadAction)}
          </button>
        }
      />

      <section className={`${cardClass} mt-6 p-4 sm:p-6`} aria-label={copy(lang, common.monthNavigation)}>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onPrevious}
            disabled={monthIndex === 0}
            aria-label={copy(lang, common.previousMonth)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:border-brand/35 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0 text-center">
            <p className="break-words font-display text-base font-bold leading-tight text-foreground sm:text-xl">
              {copy(lang, month.label)}
            </p>
            <p className="mt-1 break-words text-xs leading-snug text-muted-foreground">
              {copy(lang, month.phase)} · {copy(lang, month.range)}
            </p>
          </div>
          <button
            type="button"
            onClick={onNext}
            disabled={monthIndex === data.months.length - 1}
            aria-label={copy(lang, common.nextMonth)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:border-brand/35 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          {copy(lang, month.summary)}
        </p>
      </section>

      <div className="mt-5 space-y-4">
        {month.days.map((day) => (
          <section key={day.id} className={`${cardClass} p-4 sm:p-6`}>
            <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-display text-lg font-bold text-foreground">
                  {copy(lang, day.title)}
                </h3>
                <p className="mt-1 text-sm font-medium text-brand">
                  {copy(lang, day.focus)}
                </p>
              </div>
              <span className="inline-flex flex-none items-center gap-1.5 self-start rounded-full bg-pill px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {day.duration} {copy(lang, common.minutes)}
              </span>
            </header>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {copy(lang, day.note)}
            </p>
            <div className="mt-4 space-y-2.5">
              {day.exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  lang={lang}
                  expanded={openExerciseId === exercise.id}
                  onToggle={() => onExercise(exercise.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function NutritionView({ lang }: { lang: Lang }) {
  const data = DEMO_DATA.nutrition;
  const common = DEMO_DATA.common;
  const number = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US");
  const targetProgress = Math.min(100, (data.totalCalories / data.targetCalories) * 100);

  return (
    <div>
      <SectionIntro
        eyebrow={copy(lang, data.eyebrow)}
        title={copy(lang, data.title)}
        body={copy(lang, data.body)}
      />

      <section className={`${cardClass} mt-6 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
              {copy(lang, data.day)}
            </p>
            <h3 className="mt-2 font-display text-xl font-bold text-foreground">
              {copy(lang, data.summaryTitle)}
            </h3>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand">
            <Utensils className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {data.macros.map((macro) => (
            <div key={macro.label.en} className="min-w-0 rounded-xl bg-background/70 p-3 text-center sm:p-4">
              <dd className="break-words text-sm font-bold tabular-nums text-foreground sm:text-base">
                {macro.value}
              </dd>
              <dt className="mt-1 break-words text-[11px] leading-tight text-muted-foreground sm:text-xs">
                {copy(lang, macro.label)}
              </dt>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
            <span className="font-semibold text-foreground">
              {copy(lang, common.dailyTotal)}
            </span>
            <span className="font-bold tabular-nums text-brand">
              {number.format(data.totalCalories)} / {number.format(data.targetCalories)} {copy(lang, common.kcal)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-pill">
            <span className="block h-full rounded-full bg-brand-solid" style={{ width: `${targetProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {copy(lang, common.dailyTarget)}
          </p>
        </div>
      </section>

      <aside className="mt-4 rounded-2xl border border-brand/25 bg-brand-tint p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
          {copy(lang, data.coachNoteLabel)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">
          {copy(lang, data.coachNote)}
        </p>
      </aside>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        {data.meals.map((meal) => (
          <article key={meal.id} className={`${cardClass} p-5`}>
            <header className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tabular-nums text-brand">{meal.time}</p>
                <h3 className="mt-1 break-words font-display text-lg font-bold text-foreground">
                  {copy(lang, meal.name)}
                </h3>
              </div>
              <Apple className="h-5 w-5 flex-none text-brand" aria-hidden />
            </header>
            <ul className="mt-4 divide-y divide-border">
              {meal.items.map((item) => (
                <li key={item.name.en} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0">
                  <span className="min-w-0 break-words text-sm text-foreground">
                    {copy(lang, item.name)}
                  </span>
                  <span className="text-right text-xs leading-relaxed text-muted-foreground">
                    <span className="block">{copy(lang, item.portion)}</span>
                    <span className="block tabular-nums">{number.format(item.calories)} {copy(lang, common.kcal)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm font-bold">
              <span className="text-foreground">{copy(lang, common.mealTotal)}</span>
              <span className="tabular-nums text-brand">
                {number.format(meal.total)} {copy(lang, common.kcal)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProgressView({ lang }: { lang: Lang }) {
  const data = DEMO_DATA.progress;
  const points = data.records.map((record) => ({ date: record.date, value: record.weight }));
  const number = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 1,
  });

  return (
    <div>
      <SectionIntro
        eyebrow={copy(lang, data.eyebrow)}
        title={copy(lang, data.title)}
        body={copy(lang, data.body)}
      />

      <figure className={`${cardClass} mt-6 p-4 sm:p-6`}>
        <figcaption className="font-display text-lg font-bold text-foreground">
          {copy(lang, data.chartLabel)}
        </figcaption>
        <div
          role="group"
          tabIndex={0}
          aria-label={copy(lang, data.chartLabel)}
          aria-describedby="demo-chart-summary"
          className="mt-4 min-w-0 overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <div className="w-full min-w-0">
            <MeasurementChart points={points} unit={copy(lang, data.weight)} lang={lang} />
          </div>
        </div>
        <p id="demo-chart-summary" className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {copy(lang, data.chartSummary)}
        </p>
      </figure>

      <aside className="mt-4 rounded-2xl border border-[var(--bmi-overweight-border)] bg-[var(--bmi-overweight-bg)] p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded-full bg-[var(--bmi-overweight-fg)] px-2.5 py-1 text-xs font-bold text-[var(--bmi-overweight-bg)]">
            {copy(lang, data.bmi)}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums text-[var(--bmi-overweight-fg)]">
            {copy(lang, data.bmiValue)}
          </span>
          <span className="text-xs font-semibold text-[var(--bmi-overweight-fg)]">
            {copy(lang, data.bmiContext)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">
          {copy(lang, data.bmiNote)}
        </p>
      </aside>

      <section className={`${cardClass} mt-4 overflow-hidden`}>
        <h3 className="px-5 pt-5 font-display text-lg font-bold text-foreground sm:px-6 sm:pt-6">
          {copy(lang, data.historyTitle)}
        </h3>

        <div className="space-y-2 p-4 sm:hidden">
          {data.records.map((record) => (
            <dl key={record.date} className="grid grid-cols-2 gap-3 rounded-xl bg-background/70 p-3.5 text-sm">
              <div className="col-span-2 flex items-center justify-between gap-3 border-b border-border pb-2">
                <dt className="font-semibold text-foreground">{record.dateLabel[lang]}</dt>
                <dd className="font-bold tabular-nums text-brand">{number.format(record.weight)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{copy(lang, data.waist)}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{number.format(record.waist)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{copy(lang, data.hip)}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{number.format(record.hip)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{copy(lang, data.chest)}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{number.format(record.chest)}</dd>
              </div>
            </dl>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3">{copy(lang, data.historyTitle)}</th>
                <th className="px-4 py-3 text-right">{copy(lang, data.weight)}</th>
                <th className="px-4 py-3 text-right">{copy(lang, data.waist)}</th>
                <th className="px-4 py-3 text-right">{copy(lang, data.hip)}</th>
                <th className="px-6 py-3 text-right">{copy(lang, data.chest)}</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record.date} className="border-b border-border/70 last:border-0">
                  <th scope="row" className="px-6 py-3 text-left font-semibold text-foreground">
                    {record.dateLabel[lang]}
                  </th>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand">{number.format(record.weight)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{number.format(record.waist)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{number.format(record.hip)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">{number.format(record.chest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScheduleView({ lang, onWriteAction }: { lang: Lang; onWriteAction: () => void }) {
  const data = DEMO_DATA.schedule;
  const common = DEMO_DATA.common;

  return (
    <div>
      <SectionIntro
        eyebrow={copy(lang, data.eyebrow)}
        title={copy(lang, data.title)}
        body={copy(lang, data.body)}
      />

      <article className="mt-6 rounded-2xl border border-brand/25 bg-brand-tint p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-solid px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                {copy(lang, common.booked)}
              </span>
              <span className="text-xs font-semibold text-brand">{copy(lang, data.weekLabel)}</span>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold text-foreground">
              {copy(lang, data.appointmentTitle)}
            </h3>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {copy(lang, data.appointmentDate)} · {copy(lang, data.appointmentTime)}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {copy(lang, data.appointmentNote)}
            </p>
          </div>
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-solid text-white">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </article>

      <section className={`${cardClass} mt-4 p-5 sm:p-6`}>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-foreground">
              {copy(lang, data.availabilityTitle)}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {copy(lang, data.availabilityNote)}
            </p>
          </div>
          <span className="flex-none text-xs font-semibold text-brand">{copy(lang, data.weekLabel)}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {data.days.map((day) => (
            <div
              key={day.id}
              className={`min-w-0 rounded-xl border p-3 text-center ${STATUS_STYLE[day.status]}`}
            >
              <p className="text-xs font-bold uppercase tracking-wide">{copy(lang, day.day)}</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums">{day.date}</p>
              <p className="mt-1 truncate text-xs font-semibold">{copy(lang, day.time)}</p>
              <p className="mt-1 break-words text-[10px] leading-tight opacity-75">
                {copy(lang, common[day.status])}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onWriteAction}
          className={`${primaryButton} mt-5 w-full sm:w-auto`}
        >
          {copy(lang, data.changeAction)}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
    </div>
  );
}

export default function DemoPanel({ lang }: { lang: Lang }) {
  const [activeView, setActiveView] = useState<DemoViewId>("overview");
  const [monthIndex, setMonthIndex] = useState(1);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const actionDialog = useRef<HTMLDialogElement>(null);
  const currentMonth = DEMO_DATA.programme.months[monthIndex];
  const activeViewLabel = copy(
    lang,
    DEMO_DATA.views.find((view) => view.id === activeView)!.label,
  );

  const openWriteDialog = () => actionDialog.current?.showModal();
  const toggleExercise = (id: string) => {
    setOpenExerciseId((current) => (current === id ? null : id));
  };

  return (
    <main id="main-content" className="min-w-0 overflow-x-clip bg-background text-foreground">
      <section className="border-b border-border pb-12 pt-32 sm:pb-16 sm:pt-36">
        <div className="marketing-container">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-brand/25 bg-brand-tint px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                {copy(lang, DEMO_DATA.frame.bannerTitle)}
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                {copy(lang, DEMO_DATA.intro.eyebrow)}
              </p>
            </div>
            <h1 className="mt-4 max-w-[15ch] text-balance font-display text-[clamp(2.45rem,9vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.055em] text-foreground">
              {copy(lang, DEMO_DATA.intro.title)}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {copy(lang, DEMO_DATA.intro.body)}
            </p>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14" aria-label={copy(lang, DEMO_DATA.frame.panelLabel)}>
        <div className="marketing-container">
          <div className="min-w-0 overflow-clip rounded-[1.5rem] border border-border bg-background/85 shadow-lift sm:rounded-[2rem]">
            <aside className="sticky top-[4.5rem] z-30 flex min-w-0 items-start gap-3 border-b border-brand/25 bg-brand-tint px-4 py-3.5 text-brand shadow-sm sm:top-20 sm:items-center sm:px-6">
              <Info className="mt-0.5 h-4 w-4 flex-none sm:mt-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.13em]">
                  {copy(lang, DEMO_DATA.frame.bannerTitle)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/75">
                  {copy(lang, DEMO_DATA.frame.bannerBody)}
                </p>
              </div>
              <span className="ml-auto hidden flex-none rounded-full border border-brand/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex">
                {copy(lang, DEMO_DATA.common.readOnly)}
              </span>
            </aside>

            <header className="flex min-w-0 items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
              <span
                role="img"
                aria-label={copy(lang, DEMO_DATA.client.avatarAlt)}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-solid font-display text-sm font-extrabold text-white"
              >
                {DEMO_DATA.client.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-foreground">
                  {copy(lang, DEMO_DATA.client.name)}
                </p>
                <p className="break-words text-xs leading-relaxed text-muted-foreground">
                  {copy(lang, DEMO_DATA.frame.signedInAs)} · {copy(lang, DEMO_DATA.client.coach)}
                </p>
              </div>
              <span className="hidden flex-none text-xs font-medium text-muted-foreground md:block">
                {copy(lang, DEMO_DATA.client.memberSince)}
              </span>
            </header>

            <nav className="border-b border-border p-2 sm:p-3" aria-label={copy(lang, DEMO_DATA.frame.navigationLabel)}>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {DEMO_DATA.views.map((view) => {
                  const Icon = VIEW_ICONS[view.icon];
                  const active = activeView === view.id;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setActiveView(view.id)}
                      aria-pressed={active}
                      className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:text-sm ${
                        active
                          ? "bg-brand-solid text-white shadow-soft"
                          : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-none" aria-hidden />
                      <span className="min-w-0 break-words text-center leading-tight">
                        {copy(lang, view.label)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <p className="sr-only" aria-live="polite">
              {activeViewLabel}
            </p>
            <section className="min-w-0 p-4 sm:p-6 lg:p-8">
              {activeView === "overview" && (
                <OverviewView
                  lang={lang}
                  onProgramme={() => setActiveView("programme")}
                  onWriteAction={openWriteDialog}
                />
              )}
              {activeView === "programme" && (
                <ProgrammeView
                  lang={lang}
                  month={currentMonth}
                  monthIndex={monthIndex}
                  openExerciseId={openExerciseId}
                  onPrevious={() => setMonthIndex((current) => Math.max(0, current - 1))}
                  onNext={() =>
                    setMonthIndex((current) =>
                      Math.min(DEMO_DATA.programme.months.length - 1, current + 1),
                    )
                  }
                  onExercise={toggleExercise}
                  onWriteAction={openWriteDialog}
                />
              )}
              {activeView === "nutrition" && <NutritionView lang={lang} />}
              {activeView === "progress" && <ProgressView lang={lang} />}
              {activeView === "schedule" && (
                <ScheduleView lang={lang} onWriteAction={openWriteDialog} />
              )}
            </section>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-14 sm:py-20">
        <div className="marketing-container">
          <div className="rounded-[1.5rem] border border-brand/25 bg-brand-tint p-6 sm:p-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-brand">
                <Sparkles className="h-4 w-4" aria-hidden />
                <p className="text-xs font-bold uppercase tracking-[0.16em]">
                  {copy(lang, DEMO_DATA.closing.eyebrow)}
                </p>
              </div>
              <h2 className="mt-3 text-balance font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {copy(lang, DEMO_DATA.closing.title)}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {copy(lang, DEMO_DATA.closing.body)}
              </p>
              <Link
                href="/assessment"
                prefetch={false}
                className={`${primaryButton} mt-6 w-full sm:w-auto`}
              >
                {copy(lang, DEMO_DATA.closing.action)}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <dialog
        ref={actionDialog}
        aria-labelledby="demo-action-title"
        aria-describedby="demo-action-body"
        className="m-auto w-[calc(100%_-_1.5rem)] max-w-[30rem] rounded-[1.5rem] border border-border bg-background p-0 text-foreground shadow-lift backdrop:bg-scrim"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            onClick={() => actionDialog.current?.close()}
            aria-label={copy(lang, DEMO_DATA.common.close)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <p className="pr-12 text-xs font-bold uppercase tracking-[0.16em] text-brand">
            {copy(lang, DEMO_DATA.actionDialog.eyebrow)}
          </p>
          <h2 id="demo-action-title" className="mt-3 pr-10 font-display text-2xl font-extrabold tracking-tight text-foreground">
            {copy(lang, DEMO_DATA.actionDialog.title)}
          </h2>
          <p id="demo-action-body" className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {copy(lang, DEMO_DATA.actionDialog.body)}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => actionDialog.current?.close()}
              className={quietButton}
            >
              {copy(lang, DEMO_DATA.common.close)}
            </button>
            <Link
              href="/assessment"
              prefetch={false}
              className={primaryButton}
            >
              {copy(lang, DEMO_DATA.actionDialog.assessment)}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </dialog>
    </main>
  );
}
