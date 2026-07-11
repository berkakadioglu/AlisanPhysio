import { Gem, Crown, Medal, Shield } from "lucide-react";
import { MEMBERSHIP_LABEL, type Membership } from "@/lib/membership";

/**
 * A small, tasteful colored badge for a membership tier. Pure presentational
 * (no hooks/handlers), so it renders in both server and client components.
 * Colors are muted and low-saturation to harmonize with the forest-green theme.
 */
// Muted, low-saturation tiers that still hold their own on a white/green-tinted
// card — each has a clearly visible border and a readable foreground. Platinum
// especially needs a distinct cool border so it doesn't wash out on white.
const TIER: Record<
  Membership,
  { Icon: typeof Gem; bg: string; fg: string; border: string }
> = {
  platinum: { Icon: Gem, bg: "#e6ebf2", fg: "#334155", border: "#a9b6ca" },
  gold: { Icon: Crown, bg: "#fbeecb", fg: "#7d5e12", border: "#dcc069" },
  silver: { Icon: Medal, bg: "#eceef1", fg: "#4b5563", border: "#b6bdc7" },
  bronze: { Icon: Shield, bg: "#f3e3d3", fg: "#7c451f", border: "#cfa478" },
};

export default function MembershipBadge({
  membership,
  size = "md",
  className = "",
}: {
  membership: Membership;
  size?: "sm" | "md";
  className?: string;
}) {
  const { Icon, bg, fg, border } = TIER[membership];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${pad} ${className}`}
      style={{ backgroundColor: bg, color: fg, borderColor: border }}
    >
      <Icon className={icon} strokeWidth={2.25} aria-hidden />
      {MEMBERSHIP_LABEL[membership]}
    </span>
  );
}
