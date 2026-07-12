import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

/**
 * Resolve the explicit theme choice from the `theme` cookie for a server
 * render. Returns null when unset — in that case we do NOT force a class
 * server-side and let the inline script pick the OS preference before paint
 * (the <html> carries suppressHydrationWarning to absorb that correction).
 */
export async function getTheme(): Promise<Theme | null> {
  const store = await cookies();
  const v = store.get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : null;
}
