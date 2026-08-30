import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import PanelSectionIntro from "@/components/panel-section-intro";

export default function DashboardSectionIntro({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: {
    label: string;
    href: string;
    icon?: LucideIcon;
  };
}) {
  const ActionIcon = action?.icon;
  return (
    <PanelSectionIntro
      eyebrow={eyebrow}
      title={title}
      body={body}
      headingLevel={1}
      action={
        action ? (
        <Link
          href={action.href}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-brand/35 hover:bg-brand-tint hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" aria-hidden />}
          {action.label}
        </Link>
        ) : undefined
      }
    />
  );
}

export function DashboardEmptyState({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-dashed border-border bg-surface/45 text-center ${
        compact ? "px-4 py-6" : "px-6 py-12"
      }`}
    >
      <p className="font-display text-base font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
