"use client";

import type { Lang } from "@/lib/i18n";

/**
 * A lightweight, dependency-free SVG bar chart for the measurement trend.
 * Responsive via a viewBox (scales to its container width). Bars use a zoomed
 * y-domain (not forced to zero) so small week-to-week changes stay visible.
 */
export default function MeasurementChart({
  points,
  unit,
  lang,
}: {
  /** Chronological (oldest → newest). value is weight or BMI. */
  points: { date: string; value: number }[];
  unit: string;
  lang: Lang;
}) {
  const W = 660;
  const H = 260;
  const padL = 44;
  const padR = 14;
  const padT = 22;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin;
  const pad = spread > 0 ? spread * 0.2 : Math.max(rawMax * 0.08, 1);
  const domainMin = Math.max(0, rawMin - pad);
  const domainMax = rawMax + pad;
  const domain = domainMax - domainMin || 1;

  const y = (v: number) => padT + plotH - ((v - domainMin) / domain) * plotH;

  const n = points.length;
  const slot = plotW / n;
  const barW = Math.min(48, slot * 0.6);

  const fmtNum = (v: number) =>
    new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
      maximumFractionDigits: 1,
    }).format(v);

  const fmtDate = (iso: string) => {
    const [yy, mm, dd] = iso.split("-").map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString(
      lang === "tr" ? "tr-TR" : "en-US",
      { month: "short", day: "numeric", timeZone: "UTC" },
    );
  };

  // Three gridlines: bottom (domainMin), middle, top (domainMax).
  const ticks = [domainMin, domainMin + domain / 2, domainMax];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        className="h-auto w-full min-w-[260px]"
        style={{ maxHeight: 300 }}
      >
        {/* Gridlines + y labels */}
        {ticks.map((tv, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(tv)}
              y2={y(tv)}
              style={{ stroke: "var(--border)" }}
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={y(tv) + 4}
              textAnchor="end"
              style={{ fill: "var(--text-subtle)" }}
              fontSize={11}
            >
              {fmtNum(tv)}
            </text>
          </g>
        ))}

        {/* Bars + value + date labels */}
        {points.map((p, i) => {
          const cx = padL + slot * i + slot / 2;
          const barX = cx - barW / 2;
          const barY = y(p.value);
          const barH = padT + plotH - barY;
          return (
            <g key={i}>
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={Math.max(barH, 1)}
                rx={5}
                style={{ fill: "var(--brand)" }}
              />
              <text
                x={cx}
                y={barY - 6}
                textAnchor="middle"
                style={{ fill: "var(--brand-bright)" }}
                fontSize={11}
                fontWeight={600}
              >
                {fmtNum(p.value)}
              </text>
              <text
                x={cx}
                y={H - padB + 18}
                textAnchor="middle"
                style={{ fill: "var(--text-muted)" }}
                fontSize={11}
              >
                {fmtDate(p.date)}
              </text>
            </g>
          );
        })}

        {/* Unit caption */}
        <text
          x={padL - 8}
          y={padT - 8}
          textAnchor="end"
          style={{ fill: "var(--text-subtle)" }}
          fontSize={10}
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}
