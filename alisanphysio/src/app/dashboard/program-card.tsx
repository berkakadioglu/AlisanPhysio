"use client";

import Link from "next/link";
import { formatMonth } from "@/lib/i18n";
import { countLabel, dayLabel } from "@/lib/program-summary";
import { richTextExcerpt } from "@/lib/rich-text";
import { useI18n } from "@/app/i18n-provider";
import DayChips from "./day-chips";

interface ProgramCardProps {
  id: string;
  title: string;
  monthStartDate: string;
  notes: string | null;
  exerciseCount: number;
  dayTitles?: string[];
  hero?: boolean;
  accent?: boolean;
  href?: string;
  dayChips?: boolean;
}

export default function ProgramCard({
  id,
  title,
  monthStartDate,
  notes,
  exerciseCount,
  dayTitles = [],
  hero = false,
  accent = false,
  href,
  dayChips = false,
}: ProgramCardProps) {
  const { lang } = useI18n();
  const days = dayLabel(dayTitles, lang);
  const count = countLabel(dayTitles, exerciseCount, lang);
  const highlighted = hero || accent;
  // Cards show the notes as one plain line (no Markdown markers).
  const excerpt = richTextExcerpt(notes);

  return (
    <Link
      href={href ?? `/dashboard/${id}`}
      className={[
        "group relative block overflow-hidden rounded-2xl bg-surface transition duration-200 ease-out",
        "hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        hero ? "p-6 sm:p-8" : "p-5 sm:p-6",
        highlighted
          ? "shadow-lift ring-1 ring-brand/20 before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-brand"
          : "shadow-soft hover:shadow-lift",
      ].join(" ")}
    >
      <p className="text-xs font-medium uppercase tracking-widest text-subtle-foreground">
        {formatMonth(monthStartDate, lang)}
      </p>
      <h3
        className={[
          "mt-1.5 font-display font-bold leading-tight tracking-tight text-foreground transition group-hover:text-brand",
          hero ? "text-2xl sm:text-3xl" : "text-lg",
        ].join(" ")}
      >
        {title}
      </h3>

      {dayChips ? <div className="mt-1.5"><DayChips titles={dayTitles} lang={lang} /></div> : days && (
        <p className="mt-1.5 truncate text-sm font-medium text-muted-foreground">
          {days}
        </p>
      )}

      {excerpt && (
        <p
          className={[
            "mt-2.5 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]",
            hero ? "line-clamp-3" : "line-clamp-2",
          ].join(" ")}
        >
          {excerpt}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="min-w-0 truncate text-xs font-medium text-subtle-foreground">
          {count}
        </span>
        <span
          aria-hidden
          className="flex-none text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
        >
          →
        </span>
      </div>
    </Link>
  );
}
