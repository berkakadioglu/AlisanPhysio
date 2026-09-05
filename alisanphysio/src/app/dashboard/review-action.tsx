import { reviewContext, isReviewDue } from "@/lib/reviews";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";

export default async function ReviewAction({
  programId,
  monthStartDate,
  reviewed,
  lang,
  block = false,
}: {
  programId: string;
  monthStartDate: string;
  reviewed: boolean;
  lang: Lang;
  block?: boolean;
}) {
  const { now, timeZone } = await reviewContext();
  if (!reviewed && !isReviewDue(monthStartDate, now, timeZone)) return null;
  const href = `/dashboard/review?program=${programId}`;
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
