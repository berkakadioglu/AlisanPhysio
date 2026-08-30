import type { AssessmentStatus } from "@/lib/assessment";
import { t, type Lang } from "@/lib/i18n";

const STATUS_STYLE: Record<AssessmentStatus, string> = {
  new: "bg-brand-solid text-white",
  contacted: "bg-brand-tint text-brand",
  accepted: "bg-brand-tint text-brand",
  declined: "bg-pill text-muted-foreground",
};

export default function RequestStatusBadge({
  status,
  lang,
}: {
  status: AssessmentStatus;
  lang: Lang;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      {t(lang, `requests.status.${status}`)}
    </span>
  );
}

