import type { Lang } from "@/lib/i18n";

function supported(value: unknown): value is Lang {
  return value === "en" || value === "tr";
}

function fromAcceptLanguage(value: string | null): Lang | null {
  if (!value) return null;

  const choices = value
    .split(",")
    .map((part, index) => {
      const [range, ...params] = part.trim().toLowerCase().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const parsedQ = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { range, q: Number.isFinite(parsedQ) ? parsedQ : 0, index };
    })
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { range } of choices) {
    const base = range.split("-")[0];
    if (supported(base)) return base;
  }

  return null;
}

export function resolveLanguagePreference({
  profileLanguage,
  cookieLanguage,
  acceptLanguage,
  country,
}: {
  profileLanguage: unknown;
  cookieLanguage: unknown;
  acceptLanguage: string | null;
  country: string | null;
}): Lang {
  if (supported(profileLanguage)) return profileLanguage;
  if (supported(cookieLanguage)) return cookieLanguage;

  const headerLanguage = fromAcceptLanguage(acceptLanguage);
  if (headerLanguage) return headerLanguage;

  return country?.toUpperCase() === "TR" ? "tr" : "en";
}
