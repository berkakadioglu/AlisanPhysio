"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  GripVertical,
  Link2,
  Play,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { ExerciseCategory, LibraryExercise } from "@/lib/types";
import { t as translate, type Lang } from "@/lib/i18n";
import { isRichTextEmpty, richTextExcerpt } from "@/lib/rich-text";
import { effectiveVideoId, externalVideoUrl, parseYouTubeId, youtubeThumb } from "@/lib/youtube";
import { useI18n } from "@/app/i18n-provider";
import YouTubeEmbed from "@/components/youtube-embed";
import RichTextEditor from "@/components/rich-text-editor";
import LibraryCombobox from "../library-combobox";
import type { ExerciseDraft } from "./drafts";
import { appendChip, doseParts, doseText, libraryEntryHref, singleLine, videoSource } from "./dose";
import SetsStepper from "./sets-stepper";

/** Who a per-exercise video override is for (only changes the wording):
 *  "client" in a client's programme, "generic" in catalogue programmes and
 *  saved days, which have no client yet. */
export type VideoAudience = "client" | "generic";

/** Quick chips under Reps/time; their text is read in the programme's language. */
const CHIPS = ["eachSide", "eachLeg", "secHold", "toFailure", "amrap"] as const;

/** The hatched "no video" surface (tokens only, so it re-themes). */
export const HATCH =
  "border border-border bg-[repeating-linear-gradient(135deg,var(--pill)_0_5px,var(--surface)_5px_10px)]";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground shadow-sm outline-none transition placeholder:text-subtle-foreground focus:border-brand/40 focus:ring-2 focus:ring-brand/15 sm:text-sm";

const sectionLabel =
  "text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground";

// aria-disabled (not `disabled`) on the move buttons: a button that becomes
// unavailable under focus (moved to the top / bottom) must keep focus.
const footerBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-35 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground sm:min-h-9";

/** Whether the browser sizes a textarea to its content in CSS alone. */
function supportsFieldSizing() {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");
}

/**
 * The Reps/time field: one logical line that WRAPS, so a long prescription
 * ("8 reps hold for 3 sec each side · 3–5 sec hold") is fully readable when
 * the row is open. Enter never inserts a line break and pasted breaks become
 * spaces. It grows with its content (CSS field-sizing, or a measured height
 * where that isn't supported).
 */
function RepsField({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing()) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    // Re-fit when the column's width changes (wrapping changes), not on our own height changes.
    let width = el.clientWidth;
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fit();
          });
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      onChange={(e) => onChange(singleLine(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      autoComplete="off"
      enterKeyHint="done"
      placeholder={placeholder}
      className={`block min-h-11 resize-none overflow-hidden py-[11px] leading-5 [field-sizing:content] [overflow-wrap:anywhere] ${inputClass}`}
    />
  );
}

export interface HandleProps {
  ref: (el: HTMLElement | null) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * One exercise in the selected day. Collapsed it is a single line — drag
 * handle, index, video thumbnail (hatched when there's none), name + cue
 * excerpt, dose pill, chevron — with the interactive parts as siblings (no
 * nested buttons). Expanded it shows the exercise picker and prescription
 * (sets stepper, reps/time + quick chips, WYSIWYG cues) on the left and the
 * inline video with its source and the per-exercise override on the right.
 */
export default function ExerciseRow({
  exercise,
  index,
  count,
  playNonce,
  duplicate,
  linked,
  library,
  categories,
  contentLang,
  audience = "generic",
  reorderHintId,
  dragging,
  sorting,
  itemRef,
  style,
  handleProps,
  onPatch,
  onToggle,
  onPlay,
  onMove,
  onRemove,
}: {
  exercise: ExerciseDraft;
  index: number;
  count: number;
  /** undefined = collapsed; 0 = open; > 0 = open and the video autoplays
   *  (a new number remounts the player so it plays again). */
  playNonce: number | undefined;
  duplicate: boolean;
  /** The linked library entry, when the row is linked and it still exists. */
  linked: LibraryExercise | undefined;
  library: LibraryExercise[];
  categories: ExerciseCategory[];
  contentLang: Lang;
  /** Wording of the video override ("…for this client" vs "…for this exercise"). */
  audience?: VideoAudience;
  reorderHintId: string;
  dragging: boolean;
  /** A drag is in progress in this list (the other rows slide out of the way). */
  sorting: boolean;
  itemRef: (el: HTMLElement | null) => void;
  style: CSSProperties | undefined;
  handleProps: HandleProps;
  onPatch: (patch: Partial<ExerciseDraft>) => void;
  onToggle: () => void;
  onPlay: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t, lang } = useI18n();
  const uid = useId();
  const panelId = `${uid}-panel`;
  const nameId = `${uid}-name`;
  const setsLabelId = `${uid}-sets`;
  const repsId = `${uid}-reps`;
  const cuesLabelId = `${uid}-cues`;
  const overrideId = `${uid}-video`;
  const overrideHintId = `${uid}-video-hint`;

  const open = playNonce !== undefined;
  const name = exercise.name.trim();
  const displayName = name || t("ed.row.untitled");
  const excerpt = richTextExcerpt(exercise.instructions, 160);
  const dose = doseParts(exercise.sets, exercise.reps, lang);
  const doseFull = doseText(dose);

  const libraryUrl = linked?.youtube_url ?? null;
  const videoId = effectiveVideoId(exercise.media_url, libraryUrl);
  const source = videoSource(exercise.media_url, libraryUrl);
  const libraryHasVideo = Boolean(parseYouTubeId(libraryUrl));
  const override = exercise.media_url ?? "";
  // A non-YouTube http(s) override that the client gets as a "Watch demo"
  // link (same rule as the client view), so the editor says so.
  const externalUrl = externalVideoUrl(exercise.media_url, libraryUrl);
  const overrideInvalid = override.trim() !== "" && !parseYouTubeId(override) && !externalUrl;
  const overrideHint = overrideInvalid || externalUrl !== null;
  const forClient = audience === "client";
  const atTop = index === 0;
  const atBottom = index === count - 1;

  function pick(item: LibraryExercise) {
    onPatch({
      name: item.name,
      library_id: item.id,
      saveToLibrary: false,
      // Pre-fill the cues from the library only when the coach hasn't written any.
      instructions: isRichTextEmpty(exercise.instructions)
        ? (item.default_instructions ?? exercise.instructions)
        : exercise.instructions,
    });
  }

  return (
    <li
      ref={itemRef}
      style={style}
      className={`group/row bg-surface first:rounded-t-xl last:rounded-b-xl ${
        dragging
          ? "shadow-lift ring-2 ring-brand/30"
          : sorting
            ? // Only while sorting: the drop itself must not animate rows
              // from their shifted spot into the new order.
              "motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out"
            : ""
      }`}
    >
      {/* ---- collapsed line ---- */}
      <div className="flex min-h-14 min-w-0 items-center gap-1.5 pl-1 pr-1.5 @md:gap-2.5 @md:pl-1.5 @md:pr-2">
        <button
          type="button"
          {...handleProps}
          aria-label={t("ed.row.reorder", { name: displayName })}
          aria-describedby={reorderHintId}
          // 32px wide in the layout, 44px to touch (the ::before reaches into the gaps).
          className={`relative flex h-11 w-8 flex-none touch-none select-none items-center justify-center rounded-md text-subtle-foreground transition before:absolute before:inset-y-0 before:-inset-x-1.5 before:content-[''] hover:bg-pill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>

        <span
          aria-hidden
          className="hidden w-5 flex-none text-right text-xs font-semibold tabular-nums text-subtle-foreground @xs:block"
        >
          {index + 1}
        </span>

        {videoId ? (
          <button
            type="button"
            onClick={onPlay}
            aria-label={t("ed.row.playVideo", { name: displayName })}
            // The button is a full 44px tall touch target around the 16:9 thumbnail.
            className="group/thumb flex h-11 w-12 flex-none items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 @md:w-16"
          >
            <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-pill">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={youtubeThumb(videoId)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-scrim transition group-hover/thumb:bg-transparent">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-solid text-white shadow-soft">
                  <Play className="ml-px h-2.5 w-2.5 fill-current" aria-hidden />
                </span>
              </span>
            </span>
          </button>
        ) : (
          <span
            aria-hidden
            onClick={onToggle}
            className="flex h-11 w-12 flex-none cursor-pointer items-center @md:w-16"
          >
            <span className={`block aspect-video w-full rounded-md ${HATCH}`} />
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pl-1 pr-1.5 text-left transition hover:bg-pill/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 @md:gap-3"
        >
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`truncate text-sm ${
                  name ? "font-semibold text-foreground" : "font-medium italic text-muted-foreground"
                }`}
              >
                {displayName}
              </span>
              {duplicate && (
                <span title={t("ed.row.duplicateShort")} className="flex-none text-warning">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">{t("ed.row.duplicateShort")}</span>
                </span>
              )}
            </span>
            {excerpt && (
              <span className="block truncate text-xs text-muted-foreground">{excerpt}</span>
            )}
          </span>
          {doseFull && (
            <span
              title={doseFull}
              className="block max-w-[42%] flex-none truncate rounded-full bg-brand-tint px-2.5 py-1 text-xs tabular-nums text-brand"
            >
              {dose.sets && <b className="font-bold">{dose.sets}</b>}
              {dose.rest}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 flex-none text-subtle-foreground motion-safe:transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
      </div>

      {/* ---- expanded editor ---- */}
      <div
        id={panelId}
        hidden={!open}
        className="border-t border-border bg-background group-last/row:rounded-b-xl"
      >
        {open && (
          <div className="grid gap-x-6 gap-y-5 p-3 @md:p-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] @4xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            {/* LEFT — exercise + prescription + cues */}
            {/* Named container: stepper + reps sit side by side only when THIS
                column is wide enough (not the whole list). */}
            <div className="@container/rx min-w-0 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor={nameId} className={sectionLabel}>
                  {t("ed.row.exercise")}
                </label>
                <LibraryCombobox
                  id={nameId}
                  items={library}
                  categories={categories}
                  value={exercise.name}
                  linked={Boolean(exercise.library_id)}
                  onPick={pick}
                  onType={(value) => onPatch({ name: value, library_id: null })}
                />
                {duplicate && (
                  <p className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-warning">
                    <TriangleAlert className="h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("ed.row.duplicateShort")}
                  </p>
                )}
                {!exercise.library_id && name !== "" && (
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 px-0.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={exercise.saveToLibrary}
                      onChange={(e) => onPatch({ saveToLibrary: e.target.checked })}
                      className="h-4 w-4 flex-none rounded border-border accent-[var(--brand-solid)]"
                    />
                    {t("ed.row.saveToLibrary")}
                  </label>
                )}
              </div>

              <fieldset className="min-w-0 space-y-2.5">
                <legend className={`${sectionLabel} mb-1.5`}>{t("ed.row.prescription")}</legend>
                <div className="grid items-start gap-3 @md/rx:grid-cols-[auto_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <span id={setsLabelId} className="block text-xs font-medium text-muted-foreground">
                      {t("ed.row.sets")}
                    </span>
                    <SetsStepper
                      value={exercise.sets}
                      onChange={(sets) => onPatch({ sets })}
                      labelledBy={setsLabelId}
                      inputLabel={t("ed.row.sets")}
                      decrementLabel={t("ed.row.fewerSets")}
                      incrementLabel={t("ed.row.moreSets")}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label htmlFor={repsId} className="block text-xs font-medium text-muted-foreground">
                      {t("ed.row.reps")}
                    </label>
                    <RepsField
                      id={repsId}
                      value={exercise.reps ?? ""}
                      onChange={(reps) => onPatch({ reps })}
                      placeholder={t("ed.row.repsPlaceholder")}
                    />
                  </div>
                </div>
                <div role="group" aria-label={t("ed.row.quickAdd")} className="flex flex-wrap gap-1.5">
                  {CHIPS.map((chip) => {
                    const text = translate(contentLang, `ed.chip.${chip}`);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => onPatch({ reps: appendChip(exercise.reps, text) })}
                        aria-label={t("ed.row.chipAria", { text })}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-medium text-muted-foreground transition hover:border-brand/40 hover:bg-brand-tint hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:min-h-8"
                      >
                        <span aria-hidden className="text-subtle-foreground">+</span>
                        {text}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <p id={cuesLabelId} className={sectionLabel}>
                  {t("ed.row.cues")}
                </p>
                <RichTextEditor
                  value={exercise.instructions ?? ""}
                  onChange={(markdown) => onPatch({ instructions: markdown })}
                  ariaLabel={t("ed.row.cues")}
                  placeholder={t("ed.row.cuesPlaceholder")}
                  minRows={4}
                />
              </div>
            </div>

            {/* RIGHT — video */}
            <section aria-labelledby={`${uid}-video-heading`} className="min-w-0 space-y-2.5">
              <h4 id={`${uid}-video-heading`} className={sectionLabel}>
                {t("ed.video.heading")}
              </h4>
              {videoId ? (
                <YouTubeEmbed
                  key={`${videoId}:${playNonce}`}
                  id={videoId}
                  title={displayName}
                  autoplay={(playNonce ?? 0) > 0}
                  playLabel={t("ed.row.playVideo", { name: displayName })}
                />
              ) : (
                <div
                  className={`flex aspect-video w-full items-center justify-center rounded-xl ${HATCH}`}
                >
                  <span className="mx-3 rounded-full bg-surface px-3 py-1 text-center text-xs font-medium text-muted-foreground shadow-soft">
                    {externalUrl ? t("ed.video.linkOnly") : t("ed.video.none")}
                  </span>
                </div>
              )}

              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {source === "override" ? (
                  <>
                    <span className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">
                      {t(forClient ? "ed.video.override" : "ed.video.overrideGeneric")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPatch({ media_url: null })}
                      className="inline-flex min-h-9 items-center rounded-md px-1.5 font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {libraryHasVideo ? t("ed.video.useLibrary") : t("ed.video.remove")}
                    </button>
                  </>
                ) : source === "library" && linked ? (
                  <>
                    <span className="min-w-0 text-muted-foreground">{t("ed.video.fromLibrary")}</span>
                    {/* A new tab, so unsaved editor changes are never lost. */}
                    <a
                      href={libraryEntryHref(linked)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 min-w-0 items-center gap-1 rounded-md px-1.5 font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <span className="truncate">{t("ed.video.openLibrary")}</span>
                      <ExternalLink className="h-3 w-3 flex-none" aria-hidden />
                      <span className="sr-only">{t("ed.video.newTab")}</span>
                    </a>
                  </>
                ) : externalUrl ? (
                  <>
                    <span className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">
                      {t("ed.video.external")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPatch({ media_url: null })}
                      className="inline-flex min-h-9 items-center rounded-md px-1.5 font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {t("ed.video.remove")}
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t("ed.video.none")}</span>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor={overrideId} className="block text-xs font-medium text-muted-foreground">
                  {t(forClient ? "ed.video.overrideLabel" : "ed.video.overrideLabelGeneric")}
                </label>
                <input
                  id={overrideId}
                  type="text"
                  inputMode="url"
                  value={override}
                  onChange={(e) => onPatch({ media_url: e.target.value.trim() ? e.target.value : null })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("ed.video.overridePlaceholder")}
                  aria-invalid={overrideInvalid || undefined}
                  aria-describedby={overrideHint ? overrideHintId : undefined}
                  className={`h-11 ${inputClass}`}
                />
                {overrideInvalid && (
                  <p id={overrideHintId} className="flex items-start gap-1.5 px-0.5 text-xs font-medium text-warning">
                    <TriangleAlert className="mt-px h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("ed.video.invalid")}
                  </p>
                )}
                {externalUrl && (
                  <p id={overrideHintId} className="flex items-start gap-1.5 px-0.5 text-xs text-muted-foreground">
                    <Link2 className="mt-px h-3.5 w-3.5 flex-none" aria-hidden />
                    {t("ed.video.externalHint")}
                  </p>
                )}
              </div>
            </section>

            {/* Footer — order + remove */}
            <div className="flex flex-wrap items-center gap-1 border-t border-border pt-3 @2xl:col-span-2">
              <button
                type="button"
                onClick={() => {
                  if (!atTop) onMove(-1);
                }}
                aria-disabled={atTop || undefined}
                className={`${footerBtn} text-muted-foreground hover:bg-pill hover:text-foreground`}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
                {t("ed.row.moveUp")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!atBottom) onMove(1);
                }}
                aria-disabled={atBottom || undefined}
                className={`${footerBtn} text-muted-foreground hover:bg-pill hover:text-foreground`}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
                {t("ed.row.moveDown")}
              </button>
              <button
                type="button"
                onClick={onRemove}
                className={`${footerBtn} ml-auto text-danger hover:bg-danger-tint`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("ed.row.remove")}
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
