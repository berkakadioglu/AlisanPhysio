import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import { signOut } from "./actions";

/**
 * Shared top bar for every dashboard-family page. Wordmark that links home,
 * a language toggle, and a quiet Sign out.
 *
 * Staff (admin/manager) can reach this area via "Personal Exercises" to see
 * programs authored for themselves — so for them we surface a quiet link back
 * to the admin panel. Clients never see it.
 */
export default async function AppHeader({
  container = "max-w-3xl",
  homeHref = "/dashboard",
}: {
  container?: string;
  homeHref?: string;
}) {
  const lang = await getLang();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string | null }>();
    isStaff = profile?.role === "admin" || profile?.role === "manager";
  }
  return (
    <header className="border-b border-border bg-surface shadow-soft">
      <div
        className={`mx-auto flex ${container} items-center justify-between gap-4 px-5 py-4 sm:px-8`}
      >
        <Link
          href={homeHref}
          className="font-display text-lg font-extrabold tracking-tight text-brand"
        >
          {BRAND_NAME}
        </Link>
        <div className="flex items-center gap-2">
          {isStaff && (
            <Link
              href="/admin"
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              {t(lang, "nav.adminPanel")}
            </Link>
          )}
          <Link
            href="/dashboard/profile"
            className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
          >
            {t(lang, "profile.link")}
          </Link>
          <NotificationBell />
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
  );
}
