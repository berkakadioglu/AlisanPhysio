"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, setLangCookie, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "./i18n-provider";

/** Small TR / EN segmented toggle. Sets the `lang` cookie for the session and
 *  refreshes so every server + client string re-renders in the new language. */
export default function LanguageToggle() {
  const { lang } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(next: Lang) {
    if (next === lang) return;
    setLangCookie(next);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ language: next }).eq("id", user.id);
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-semibold">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          disabled={pending}
          aria-pressed={l === lang}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition disabled:cursor-wait disabled:opacity-60 ${
            l === lang
              ? "bg-brand-solid text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
