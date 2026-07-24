import Link from "next/link";
import { LogOut } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { signOut } from "@/app/dashboard/actions";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import RefreshButton from "./refresh-button";
import ContentNav from "./content-nav";

/**
 * Admin top bar: wordmark → /admin, primary nav (Clients, a grouped "Content"
 * dropdown for the authoring areas, and Personal Exercises), plus the utility
 * controls (notifications, theme, language, refresh, sign out).
 */
export default async function AdminHeader({
  container = "max-w-3xl",
}: {
  container?: string;
}) {
  const lang = await getLang();
  const navLink =
    "rounded-full px-3 py-1.5 font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground";
  return (
    <header className="border-b border-border bg-surface shadow-soft">
      <div
        className={`mx-auto flex ${container} items-center justify-between gap-4 px-5 py-4 sm:px-8`}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="font-display text-lg font-extrabold tracking-tight text-brand"
          >
            {BRAND_NAME}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className={navLink}>
              {t(lang, "admin.clients")}
            </Link>
            <ContentNav />
            <Link href="/dashboard" className={navLink}>
              {t(lang, "nav.personalExercises")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <ThemeToggle />
          <LanguageToggle />
          <RefreshButton />
          <form action={signOut}>
            <button
              type="submit"
              aria-label={t(lang, "common.signOut")}
              title={t(lang, "common.signOut")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
