import { cookies, headers } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";
import { resolveLanguagePreference } from "@/lib/language-resolution";
import { DEMO_REQUEST_HEADER } from "@/lib/demo-route";

/**
 * Resolve language before rendering so <html lang>, server content and the
 * client provider all receive the same value with no wrong-language flash.
 */
export async function getLang(): Promise<Lang> {
  const requestHeaders = await headers();
  const isDemo = requestHeaders.get(DEMO_REQUEST_HEADER) === "1";
  const viewer = isDemo
    ? null
    : await (await import("@/lib/viewer")).getViewer();
  const store = await cookies();

  return resolveLanguagePreference({
    profileLanguage: viewer?.language,
    cookieLanguage: store.get(LANG_COOKIE)?.value,
    acceptLanguage: requestHeaders.get("accept-language"),
    country: requestHeaders.get("x-vercel-ip-country"),
  });
}
