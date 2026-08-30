"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, setLangCookie, type Lang } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";

/** Demo-safe locale control: language cookie + RSC refresh, with no auth read. */
export default function DemoLanguageToggle({
  label,
}: {
  label: string;
}) {
  const { lang } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(next: Lang) {
    if (next === lang) return;
    setLangCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-semibold"
      aria-label={label}
    >
      {LANGS.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => set(item)}
          disabled={pending}
          aria-pressed={item === lang}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition disabled:cursor-wait disabled:opacity-60 ${
            item === lang
              ? "bg-brand-solid text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
