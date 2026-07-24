import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formatWeekRange, t, type Lang } from "@/lib/i18n";

/**
 * Small, understated dashboard entry point shown ONLY when the client has a
 * pending availability request (current-or-future week, not yet answered). A
 * light brand accent gives it a nudge without competing with the program hero.
 */
export default function AvailabilityCard({
  weekStart,
  lang,
}: {
  weekStart: string;
  lang: Lang;
}) {
  return (
    <Link
      href={`/dashboard/availability?week=${weekStart}`}
      className="group flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-tint/60 px-4 py-3.5 transition hover:border-brand/50 hover:bg-brand-tint"
    >
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-solid text-white">
        <CalendarClock className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground transition group-hover:text-brand">
          {t(lang, "avail.cardPending")}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatWeekRange(weekStart, lang)}
        </p>
      </div>
      <span
        aria-hidden
        className="ml-auto text-brand transition group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
