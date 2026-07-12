import { createClient } from "@/lib/supabase/server";
import { prevMondayISO } from "@/lib/program-dates";
import { todayISO } from "@/lib/membership";
import { formatDay, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

/** Whole-day difference b - a for two YYYY-MM-DD strings (UTC, no drift). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

interface NewNotif {
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  dedupe_key: string;
}

/**
 * Create the signed-in user's system notifications, idempotently, on app load.
 * No cron: this runs server-side on the dashboard render. Duplicates are
 * prevented by a stable dedupe_key + UNIQUE(user_id, dedupe_key) upsert with
 * ignoreDuplicates. When a condition is resolved (height added, review filed),
 * the corresponding unread notification is marked read.
 *
 * Runs as the USER's session, so every insert is user_id = auth.uid()
 * (notifications_insert_own) — never the service role.
 */
export async function generateSystemNotifications(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, height_cm, membership, membership_end_date")
    .eq("id", user.id)
    .single<{
      id: string;
      role: string;
      height_cm: number | null;
      membership: string | null;
      membership_end_date: string | null;
    }>();
  if (!profile) return;

  const lang = await getLang();
  const today = todayISO();
  const isClient = profile.role === "client";

  const toInsert: NewNotif[] = [];
  const resolveKeys: string[] = [];

  // --- missing_info (clients only): needs height for BMI --------------------
  if (isClient) {
    if (profile.height_cm == null) {
      toInsert.push({
        type: "missing_info",
        title: t(lang, "notif.missingInfo.title"),
        body: t(lang, "notif.missingInfo.body"),
        link: "/dashboard/profile",
        dedupe_key: "missing_info",
      });
    } else {
      resolveKeys.push("missing_info");
    }
  }

  // --- membership_expiry (clients only): within ~7 days or past -------------
  if (isClient && profile.membership && profile.membership_end_date) {
    const end = profile.membership_end_date;
    if (daysBetween(today, end) <= 7) {
      const ended = end < today;
      toInsert.push({
        type: "membership_expiry",
        title: t(lang, ended ? "notif.expiry.titleEnded" : "notif.expiry.titleSoon"),
        body: t(lang, "notif.expiry.body", { date: formatDay(end, lang) }),
        link: null,
        dedupe_key: `membership_expiry:${end}`,
      });
    }
  }

  // --- weekly_review (any role with a program for last week) ----------------
  const reviewWeek = prevMondayISO();
  const { data: progs } = await supabase
    .from("programs")
    .select("id")
    .eq("client_id", user.id)
    .eq("week_start_date", reviewWeek)
    .limit(1);
  if ((progs?.length ?? 0) > 0) {
    const { data: review } = await supabase
      .from("weekly_reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", reviewWeek)
      .maybeSingle();
    const key = `weekly_review:${reviewWeek}`;
    if (review) {
      resolveKeys.push(key);
    } else {
      toInsert.push({
        type: "weekly_review",
        title: t(lang, "notif.review.title"),
        body: t(lang, "notif.review.body"),
        link: "/dashboard/review",
        dedupe_key: key,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase
      .from("notifications")
      .upsert(
        toInsert.map((n) => ({ ...n, user_id: user.id })),
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      );
  }
  if (resolveKeys.length > 0) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .in("dedupe_key", resolveKeys);
  }
}
