"use client";

import { createContext, useContext, useMemo } from "react";
import { t as translate, type Lang } from "@/lib/i18n";

type TFn = (key: string, params?: Record<string, string | number>) => string;

const I18nContext = createContext<{ lang: Lang; t: TFn }>({
  lang: "en",
  t: (k) => k,
});

/** Seeded from the server (root layout) with the cookie-resolved language. */
export function I18nProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ lang, t: (k: string, p?: Record<string, string | number>) => translate(lang, k, p) }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
