import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { signOut } from "@/app/dashboard/actions";
import LanguageToggle from "@/app/language-toggle";
import ThemeToggle from "@/app/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import RefreshButton from "./refresh-button";

/**
 * Admin top bar: wordmark → /admin, primary nav (Clients / Library),
 * a language toggle, a refresh control, and Sign out.
 */
export default async function AdminHeader({
  container = "max-w-3xl",
}: {
  container?: string;
}) {
  const lang = await getLang();
  return (
    <header className="border-b border-border bg-surface shadow-soft">
      <div
        className={`mx-auto flex ${container} items-center justify-between gap-4 px-5 py-4 sm:px-8`}
      >
        <div className="flex items-center gap-5">
          <Link
            href="/admin"
            className="font-display text-lg font-extrabold tracking-tight text-brand"
          >
            {BRAND_NAME}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/admin"
              className="rounded-full px-3 py-1.5 font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              {t(lang, "admin.clients")}
            </Link>
            <Link
              href="/admin/library"
              className="rounded-full px-3 py-1.5 font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
              {t(lang, "admin.library")}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full px-3 py-1.5 font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
            >
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
