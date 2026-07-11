"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n-provider";

/** Force-refetch the current admin page's server data. */
export default function RefreshButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);

  function refresh() {
    setSpin(true);
    startTransition(() => router.refresh());
    // let the spin animation play briefly even on a fast refresh
    setTimeout(() => setSpin(false), 600);
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label={t("admin.refresh")}
      title={t("admin.refresh")}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-pill hover:text-brand disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 ${spin ? "animate-spin" : ""}`}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
