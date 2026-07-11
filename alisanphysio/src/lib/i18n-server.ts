import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isLang, type Lang } from "@/lib/i18n";

/**
 * Resolve the active UI language for a server render from the `lang` cookie.
 * The cookie is seeded from the user's profiles.language at login and updated
 * by the header toggle; defaults to English (pre-auth and first visit).
 */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return isLang(v) ? v : DEFAULT_LANG;
}
