import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n";
import type { Role } from "@/lib/types";

export type Viewer = {
  userId: string;
  role: Role | null;
  language: Lang | null;
};

/**
 * Request-scoped viewer lookup shared by language resolution and public chrome.
 * A missing/unreadable profile still represents a signed-in user, with safe
 * client-facing fallbacks for role and language.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, language")
    .eq("id", user.id)
    .maybeSingle<{ role: Role | null; language: Lang | null }>();

  return {
    userId: user.id,
    role: profile?.role ?? null,
    language: profile?.language ?? null,
  };
});
