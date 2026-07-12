"use client";

import { MEMBERSHIP_TIERS, MEMBERSHIP_LABEL, type Membership } from "@/lib/membership";
import { useI18n } from "@/app/i18n-provider";

/**
 * Admin-only segmented selector: None + the four tiers (low → high).
 * Mirrors LanguageSelect's styling (active = brand highlight) for consistency.
 */
export default function MembershipSelect({
  value,
  onChange,
}: {
  value: Membership | null;
  onChange: (m: Membership | null) => void;
}) {
  const { t } = useI18n();
  const options: (Membership | null)[] = [null, ...MEMBERSHIP_TIERS];
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt ?? "none"}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-brand-solid text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt ? MEMBERSHIP_LABEL[opt] : t("membership.optionNone")}
          </button>
        );
      })}
    </div>
  );
}
