"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isLang, setLangCookie } from "@/lib/i18n";
import { portalPathForRole } from "@/lib/route-access";
import { useI18n } from "@/app/i18n-provider";

export default function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (signInError || !data.user) {
      setError(t("login.error"));
      setLoading(false);
      return;
    }

    // Seed the language cookie and resolve the portal destination from the
    // user's profile. A missing/unreadable profile safely falls back to the
    // client dashboard; the proxy remains responsible for membership access.
    const { data: profile } = await supabase
      .from("profiles")
      .select("language, role")
      .eq("id", data.user.id)
      .single();
    const stored = (
      profile as { language?: string; role?: string } | null
    )?.language;
    if (isLang(stored)) {
      setLangCookie(stored);
    }

    const role = (profile as { role?: string } | null)?.role;
    router.replace(portalPathForRole(role, true));
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-foreground shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          {t("login.email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          {t("login.password")}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand-solid px-4 py-2.5 font-medium text-white shadow-soft transition hover:bg-brand-solid-hover focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
