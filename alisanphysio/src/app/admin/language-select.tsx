"use client";

import { LANGS, type Lang } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";

/** TR / EN segmented selector for the client forms (writes profiles.language). */
export default function LanguageSelect({
  value,
  onChange,
}: {
  value: Lang;
  onChange: (l: Lang) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={l === value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            l === value
              ? "bg-brand text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
