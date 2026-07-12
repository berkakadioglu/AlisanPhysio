import { Gem, Crown, Medal, Shield } from "lucide-react";
import { MEMBERSHIP_LABEL, type Membership } from "@/lib/membership";

/**
 * A small, tasteful colored badge for a membership tier. Pure presentational
 * (no hooks/handlers), so it renders in both server and client components.
 * Colors are muted and low-saturation to harmonize with the forest-green theme.
 */
// Muted, low-saturation tiers that still hold their own on a light or dark
// card — each has a clearly visible border and a readable foreground. Colors
// resolve to CSS variables (see globals.css) so they re-theme in dark mode.
const TIER: Record<
  Membership,
  { Icon: typeof Gem; bg: string; fg: string; border: string }
> = {
  platinum: {
    Icon: Gem,
    bg: "var(--mem-platinum-bg)",
    fg: "var(--mem-platinum-fg)",
    border: "var(--mem-platinum-border)",
  },
  gold: {
    Icon: Crown,
    bg: "var(--mem-gold-bg)",
    fg: "var(--mem-gold-fg)",
    border: "var(--mem-gold-border)",
  },
  silver: {
    Icon: Medal,
    bg: "var(--mem-silver-bg)",
    fg: "var(--mem-silver-fg)",
    border: "var(--mem-silver-border)",
  },
  bronze: {
    Icon: Shield,
    bg: "var(--mem-bronze-bg)",
    fg: "var(--mem-bronze-fg)",
    border: "var(--mem-bronze-border)",
  },
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
