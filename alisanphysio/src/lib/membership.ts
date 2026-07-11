/**
 * Membership tiers. Set by the admin only (enforced in SQL — see migration
 * 0006). Tier names are proper nouns kept identical in EN and TR; only the
 * surrounding chrome ("Membership" / "Üyelik") is localized.
 */

/** Ordered low → high, for building selectors. */
export const MEMBERSHIP_TIERS = ["bronze", "silver", "gold", "platinum"] as const;

export type Membership = (typeof MEMBERSHIP_TIERS)[number];

export function isMembership(v: unknown): v is Membership {
  return (
    v === "bronze" || v === "silver" || v === "gold" || v === "platinum"
  );
}

/** Display name (proper noun, not localized). */
export const MEMBERSHIP_LABEL: Record<Membership, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

/** Today's date as YYYY-MM-DD in the server's local time (date-only compare). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Whether a CLIENT's membership grants app access: a tier must be set AND the
 * end date (if any) must not be in the past. ISO date strings compare correctly
 * lexicographically. This is only meaningful for role='client' — admins are
 * never gated by membership (see the proxy guard).
 */
export function membershipActive(
  membership: Membership | string | null | undefined,
  endDate: string | null | undefined,
  today: string,
): boolean {
  if (!membership) return false;
  if (endDate && endDate < today) return false;
  return true;
}
