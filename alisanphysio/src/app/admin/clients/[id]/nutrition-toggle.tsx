"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n-provider";
import { setNutritionEnabled } from "@/app/admin/nutrition-toggle-action";
export default function NutritionToggle({ clientId, enabled }: { clientId: string; enabled: boolean }) {
  const { t } = useI18n(); const router = useRouter();
  const [pending, setPending] = useState(false); const [error, setError] = useState(false);
  async function toggle() {
    setPending(true); setError(false);
    try { const result = await setNutritionEnabled(clientId, !enabled); if (!result) setError(true); else router.refresh(); }
    catch { setError(true); } finally { setPending(false); }
  }
  return <div><button type="button" role="switch" aria-checked={enabled} disabled={pending} onClick={toggle}
    className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50">
    {t(enabled ? "nutrition.on" : "nutrition.off")}</button>
    {error && <p role="alert" className="text-sm text-danger">{t("nutrition.error")}</p>}</div>;
}
