import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";
import { signOut } from "@/app/dashboard/actions";

export const metadata: Metadata = {
  title: `${BRAND_NAME}`,
};

/**
 * Blocked screen for a client whose membership isn't active. Routing here is
 * enforced by the proxy (client-only); this page just double-checks the session
 * and lets them sign out.
 */
export default async function MembershipInactivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lang = await getLang();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface shadow-soft">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <span className="font-display text-lg font-extrabold tracking-tight text-brand">
            {BRAND_NAME}
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
              >
                {t(lang, "common.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-14">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface/60 p-8 text-center shadow-soft sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-brand"
              aria-hidden
            >
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground">
            {t(lang, "inactive.title")}
          </h1>
          <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t(lang, "inactive.body")}
          </p>
          <form action={signOut} className="mt-7">
            <button
              type="submit"
              className="rounded-xl bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover"
            >
              {t(lang, "common.signOut")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
