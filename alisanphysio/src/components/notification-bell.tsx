"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";

export default function NotificationBell() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<Notification[]>();
    setItems(data ?? []);
  }, []);

  // Fetch on mount (system notifications are generated server-side on load).
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<Notification[]>();
      if (active) setItems(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close the panel when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    );
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  }

  async function onItemClick(n: Notification) {
    if (!n.read) await markRead([n.id]);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function markAll() {
    await markRead(items.filter((n) => !n.read).map((n) => n.id));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t("notif.aria")}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-foreground"
      >
        <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-solid px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">
              {t("notif.title")}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-medium text-brand-bright transition hover:text-brand-hover"
              >
                {t("notif.markAllRead")}
              </button>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-subtle-foreground">
                {t("notif.empty")}
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`flex w-full gap-2.5 border-b border-border/60 px-4 py-3 text-left transition last:border-0 hover:bg-pill/50 ${
                      n.read ? "" : "bg-brand-tint/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                        n.read ? "bg-transparent" : "bg-brand"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-subtle-foreground">
                        {timeAgo(n.created_at, t)}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return t("notif.justNow");
  if (mins < 60) return t("notif.minutesAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("notif.hoursAgo", { n: hrs });
  return t("notif.daysAgo", { n: Math.floor(hrs / 24) });
}
