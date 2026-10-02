"use client";

import { useId, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ChevronDown, Play } from "lucide-react";
import { exercisesCount, t, type Lang } from "@/lib/i18n";
import { exerciseEffort, type ExerciseWithVideo, type TrainingDay } from "@/lib/program-detail";
import { isRichTextEmpty } from "@/lib/rich-text";
import { effectiveVideoId, externalVideoUrl } from "@/lib/youtube";
import RichText from "@/components/rich-text";
import YouTubeEmbed from "@/components/youtube-embed";

const subscribe = () => () => {};
const serverDay = () => null;

function readDay(key: string) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export default function ProgramDays({ programId, days, lang }: { programId: string; days: TrainingDay[]; lang: Lang }) {
  const storageKey = `programme:${programId}:day`;
  // Hydration starts with the server's first day, then restores this tab's session.
  const remembered = useSyncExternalStore(subscribe, () => readDay(storageKey), serverDay);
  const [selected, setSelected] = useState<string | null>(null);
  const active = days.find((day) => day.id === (selected ?? remembered)) ?? days[0];
  const id = useId();
  if (!active) return null;

  function select(day: TrainingDay) {
    setSelected(day.id);
    try { sessionStorage.setItem(storageKey, day.id); } catch { /* Tabs still work when storage is disabled. */ }
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % days.length
      : event.key === "ArrowLeft" ? (index - 1 + days.length) % days.length
      : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : null;
    if (next == null) return;
    event.preventDefault();
    select(days[next]);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  const activeIndex = days.indexOf(active);
  return <div className="mt-7 min-w-0">
    <div role="tablist" aria-label={t(lang, "prog.days")} className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-pill p-1">
      {days.map((day, index) => <button key={day.id} id={`${id}-tab-${index}`} type="button" role="tab"
        aria-selected={day.id === active.id} aria-controls={`${id}-panel`} tabIndex={day.id === active.id ? 0 : -1}
        onClick={() => select(day)} onKeyDown={(event) => navigate(event, index)}
        className={`min-h-11 max-w-64 flex-none truncate rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-brand ${day.id === active.id ? "bg-surface text-brand shadow-sm" : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"}`} title={day.title}>
        {day.title}
      </button>)}
    </div>
    <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${activeIndex}`} tabIndex={0} className="mt-6 min-w-0 focus-visible:outline-brand">
      <h2 className="break-words font-display text-lg font-bold text-foreground [overflow-wrap:anywhere]">{active.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{exercisesCount(lang, active.exercises.length)}</p>
      <ol key={active.id} className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {active.exercises.map((exercise, index) => <ExerciseRow key={exercise.id} exercise={exercise} index={index} lang={lang} />)}
      </ol>
    </section>
  </div>;
}

function ExerciseRow({ exercise, index, lang }: { exercise: ExerciseWithVideo; index: number; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const effort = exerciseEffort(exercise, lang);
  // The exercise's own video (override) wins over the library entry's.
  const videoId = effectiveVideoId(exercise.media_url, exercise.exercise_library?.youtube_url);
  // A non-YouTube http(s) override becomes a "Watch demo" link (same rule as the editor).
  const externalVideo = externalVideoUrl(exercise.media_url, exercise.exercise_library?.youtube_url);
  const hasVideo = Boolean(videoId || externalVideo);
  const hasInstructions = !isRichTextEmpty(exercise.instructions);
  const expandable = hasInstructions || hasVideo;
  const content = <>
    <span className="w-4 flex-none text-xs tabular-nums text-subtle-foreground">{index + 1}</span>
    <span className={`min-w-0 flex-1 text-sm font-semibold text-foreground ${open ? "break-words [overflow-wrap:anywhere]" : "truncate"}`}>{exercise.name}</span>
    {effort && <span className={`max-w-[35%] flex-none text-xs font-semibold tabular-nums text-brand sm:text-sm ${open ? "break-words [overflow-wrap:anywhere]" : "truncate"}`} title={effort}>{effort}</span>}
    {hasVideo && !open && <Play className="h-3.5 w-3.5 flex-none text-brand" aria-label={t(lang, "prog.videoAvailable")} />}
    {expandable && <ChevronDown className={`h-3.5 w-3.5 flex-none text-subtle-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden />}
  </>;
  return <li>
    {expandable ? <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}
      className="flex min-h-12 w-full min-w-0 items-center gap-2 px-3 py-3 text-left transition hover:bg-pill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:gap-3 sm:px-4">
      {content}
    </button> : <div className="flex min-h-12 min-w-0 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4" title={exercise.name}>{content}</div>}
    {expandable && <div id={id} hidden={!open}>
      {open && <div className="space-y-3 px-4 pb-4 sm:pl-11">
        {hasInstructions && <RichText value={exercise.instructions} className="text-muted-foreground" />}
        {videoId && <div className="w-full max-w-sm"><YouTubeEmbed id={videoId} title={exercise.name} playLabel={t(lang, "prog.playVideo", { name: exercise.name })} /></div>}
        {externalVideo && <a href={externalVideo} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">{t(lang, "prog.watchDemo")} <span aria-hidden>↗</span></a>}
      </div>}
    </div>}
  </li>;
}
