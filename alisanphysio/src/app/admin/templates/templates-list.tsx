"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { TemplateSummary } from "@/lib/types";
import { exercisesCount } from "@/lib/i18n";
import { useI18n } from "@/app/i18n-provider";
import { useToast } from "@/app/toast";
import ProgramExportButton from "@/components/program-export-button";
import { deleteTemplate } from "../template-actions";

export default function TemplatesList({
  templates,
}: {
  templates: TemplateSummary[];
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const toast = useToast();

  async function remove(tpl: TemplateSummary) {
    if (!confirm(t("tpl.confirmDelete"))) return;
    const res = await deleteTemplate({ id: tpl.id });
    if (res.ok) {
      toast(t("toast.templateDeleted"));
      router.refresh();
    } else {
      toast(res.error);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {t("tpl.heading")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("tpl.subtitle")}
          </p>
        </div>
        <Link
          href="/admin/templates/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-solid-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          {t("tpl.new")}
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center text-sm text-subtle-foreground">
          {t("tpl.empty")}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              className="group flex items-center gap-2 rounded-2xl bg-surface p-2 pr-3 shadow-soft transition hover:shadow-lift"
            >
              <Link
                href={`/admin/templates/${tpl.id}/edit`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition hover:bg-pill/50 sm:px-4"
              >
                <span className="truncate font-semibold text-foreground group-hover:text-brand">
                  {tpl.title}
                </span>
                <span className="flex-none rounded-full bg-pill px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {exercisesCount(lang, tpl.count)}
                </span>
              </Link>
              <div className="flex-none">
                <ProgramExportButton mode="template" id={tpl.id} compact />
              </div>
              <button
                type="button"
                onClick={() => remove(tpl)}
                aria-label={t("tpl.delete")}
                title={t("tpl.delete")}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger-tint hover:text-danger"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
