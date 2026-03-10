"use client"

import { useMemo } from "react"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { hexToRgba } from "@/lib/portfolio/chains"

// ─── Protocol colors ───

const PROTOCOL_COLORS: Record<string, string> = {
  "Aave V3": "#B6509E",
  "Lido": "#00A3FF",
  "Rocket Pool": "#FF6E30",
  "Coinbase": "#0052FF",
  "Spark": "#F5841F",
  "Frax": "#000000",
  "StakeWise": "#5566FF",
  "Mantle LSP": "#2ECC94",
  "Swell": "#3068F7",
  "Ankr": "#2376E5",
  "Stader": "#2BFCB7",
  "Pendle": "#1A73E8",
  "EtherFi": "#6C3AED",
}

function hashStringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

function getProtocolColor(protocol: string): string {
  if (PROTOCOL_COLORS[protocol]) return PROTOCOL_COLORS[protocol]
  const hue = hashStringToHue(protocol)
  return `hsl(${hue}, 65%, 55%)`
}

// ─── Protocol Allocation Bar ───

export function ProtocolAllocationBar({
  breakdown,
  totalValue,
}: {
  breakdown: Record<string, number>
  totalValue: number
}) {
  const segments = useMemo(() => {
    if (!breakdown || totalValue <= 0) return []
    return Object.entries(breakdown)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        percentage: (value / totalValue) * 100,
        color: getProtocolColor(name),
      }))
  }, [breakdown, totalValue])

  if (segments.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <p className="text-xs font-medium text-foreground-muted mb-4">
        Protocol Allocation
      </p>

      {/* Bar */}
      <div
        className="flex w-full overflow-hidden mb-5"
        style={{
          height: 14,
          borderRadius: 7,
          gap: 1,
          backgroundColor: "var(--card-elevated)",
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={seg.name}
            style={{
              flex: `${seg.value} 0 0px`,
              minWidth: 3,
              background: `linear-gradient(180deg, ${hexToRgba(seg.color, 1)} 0%, ${hexToRgba(seg.color, 0.75)} 100%)`,
              borderRadius:
                i === 0 && i === segments.length - 1
                  ? 7
                  : i === 0
                    ? "7px 0 0 7px"
                    : i === segments.length - 1
                      ? "0 7px 7px 0"
                      : 0,
              boxShadow: `inset 0 1px 0 ${hexToRgba(seg.color, 0.4)}`,
              transition: "flex 0.3s ease",
            }}
            title={`${seg.name}: ${formatFiatValue(seg.value)} (${seg.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-2">
            <div
              className="rounded-full"
              style={{
                width: 14,
                height: 14,
                backgroundColor: hexToRgba(seg.color, 0.25),
                border: `1.5px solid ${hexToRgba(seg.color, 0.5)}`,
              }}
            />
            <span className="text-foreground whitespace-nowrap font-data text-[11px] font-medium">
              {seg.name}
            </span>
            <span className="text-foreground-muted whitespace-nowrap font-data text-[11px] tabular-nums">
              {formatFiatValue(seg.value)}
            </span>
            <span
              className="whitespace-nowrap font-data text-[10px] tabular-nums"
              style={{ color: hexToRgba(seg.color, 0.8) }}
            >
              {seg.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
