import type { Metadata } from "next";
import LoginForm from "./login-form";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";

export const metadata: Metadata = {
  title: `Sign in · ${BRAND_NAME}`,
};

export default async function LoginPage() {
  const lang = await getLang();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-brand">
            {BRAND_NAME}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t(lang, "login.tagline")}
          </p>
        </div>

        <div className="rounded-2xl bg-surface p-8 shadow-soft">
          <h2 className="mb-6 text-lg font-semibold text-foreground">
            {t(lang, "login.heading")}
          </h2>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-subtle-foreground">
          {t(lang, "login.helper")}
        </p>
      </div>
    </main>
  );
}
