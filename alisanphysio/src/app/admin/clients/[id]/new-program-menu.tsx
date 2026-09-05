"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { structureSummary } from "@/lib/program-summary";
import { useI18n } from "@/app/i18n-provider";

export interface ProgramSummary {
  id: string;
  title: string;
  monthStartDate: string;
  dayTitles: string[];
  exerciseCount: number;
}

export default function NewProgramMenu({
  clientId,
  programs,
  allowCatalogue = true,
}: {
  clientId: string;
  programs: ProgramSummary[];
  allowCatalogue?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const base = `/admin/clients/${clientId}/programs/new`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover"
      >
        <span aria-hidden className="text-base leading-none">
          +
        </span>{" "}
        {t("admin.newProgram")}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-lift">
            <Link
              href={base}
              className="block rounded-xl px-3.5 py-2.5 text-sm text-foreground transition hover:bg-pill"
            >
              <span className="font-medium">{t("menu.startBlank")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("menu.startBlankSub")}
              </span>
            </Link>
            {allowCatalogue && <Link href={`/admin/programs?client=${clientId}`} className="block rounded-xl px-3.5 py-2.5 text-sm text-foreground transition hover:bg-pill">
              <span className="font-medium">{t("catalog.fromCatalogue")}</span>
              <span className="block text-xs text-muted-foreground">{t("catalog.fromCatalogueSub")}</span>
            </Link>}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowCopy(true);
              }}
              className="block w-full rounded-xl px-3.5 py-2.5 text-left text-sm text-foreground transition hover:bg-pill"
            >
              <span className="font-medium">{t("menu.copyPrev")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("menu.copyPrevSub")}
              </span>
            </button>
          </div>
        </>
      )}

      {showCopy && (
        <CopyModal
          base={base}
          programs={programs}
          onClose={() => setShowCopy(false)}
        />
      )}
    </div>
  );
}

function CopyModal({
  base,
  programs,
  onClose,
}: {
  base: string;
  programs: ProgramSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-foreground">
          {t("copy.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("copy.subtitle")}</p>

        {programs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center">
            <p className="text-sm text-subtle-foreground">{t("copy.empty")}</p>
            <Link
              href={base}
              className="mt-3 inline-block rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover"
            >
              {t("copy.startInstead")}
            </Link>
          </div>
        ) : (
          <ul className="mt-5 -mr-2 space-y-2 overflow-y-auto pr-2">
            {programs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => router.push(`${base}?copyFrom=${p.id}`)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-brand/40 hover:shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground group-hover:text-brand">
                      {p.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {structureSummary(p.dayTitles, p.exerciseCount, lang)}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="flex-none text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-pill hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
