import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";

/**
 * Inline review affordance for a reviewable program (current or past week):
 * an "Add review" button, or a "Review submitted" state once a review exists
 * for that week (tapping it re-opens the form to edit — the action upserts).
 *
 * Pure presentational (plain links), so it renders in server components and can
 * sit as a sibling BELOW a ProgramCard <Link> (never nested inside one).
 * `block` makes it a full-width row for the program-detail list header.
 */
export default function ReviewAction({
  weekStart,
  reviewed,
  lang,
  block = false,
}: {
  weekStart: string;
  reviewed: boolean;
  lang: Lang;
  block?: boolean;
}) {
  const href = `/dashboard/review?week=${weekStart}`;
  const layout = block ? "flex w-full justify-center" : "inline-flex";

  if (reviewed) {
    return (
      <Link
        href={href}
        className={`${layout} items-center gap-1.5 rounded-full bg-brand-tint px-3.5 py-1.5 text-xs font-semibold text-brand transition hover:brightness-95`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        {t(lang, "review.submitted")}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`${layout} items-center gap-1.5 rounded-full border border-brand/40 bg-surface px-3.5 py-1.5 text-xs font-semibold text-brand shadow-soft transition hover:bg-brand-tint`}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      {t(lang, "review.add")}
    </Link>
  );
}
