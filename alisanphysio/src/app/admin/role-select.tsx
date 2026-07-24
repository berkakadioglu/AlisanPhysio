"use client";

import type { Role } from "@/lib/types";
import { useI18n } from "@/app/i18n-provider";

// Manager is intentionally omitted from the UI while that feature is postponed.
// The role still exists in the DB / RLS (is_staff() = admin|manager); it's just
// not offered here, so admins can only assign Client or Admin for now.
const ROLES: Role[] = ["client", "admin"];

/**
 * Admin-only segmented role selector (Client / Admin). Mirrors the
 * membership/language selectors' styling. Disabled when editing your own row
 * (prevents self-lockout — the server also rejects it).
 */
export default function RoleSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: Role;
  onChange: (r: Role) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`inline-flex rounded-xl border border-border bg-surface p-1 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {ROLES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            aria-pressed={active}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-brand-solid text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } ${disabled ? "cursor-not-allowed" : ""}`}
          >
            {t(`role.${r}`)}
          </button>
        );
      })}
    </div>
  );
}
