"use client"

import { useMemo } from "react"
import { ChainIcon } from "@/components/portfolio/chain-icon"
import { getChainMeta, getChainColor, hexToRgba } from "@/lib/portfolio/chains"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"

interface ChainAllocationBarProps {
  locations: Record<string, number | string>
  totalValue: number
  isHidden?: boolean
}

interface ChainSegment {
  key: string
  label: string
  value: number
  percentage: number
  color: string
  hasIcon: boolean
}

export function ChainAllocationBar({ locations, totalValue, isHidden }: ChainAllocationBarProps) {
  const segments: ChainSegment[] = useMemo(() => {
    if (!locations || totalValue <= 0) return []

    const raw = Object.entries(locations)
      .map(([key, val]) => ({
        key,
        value: typeof val === "string" ? parseFloat(val) || 0 : val,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)

    return raw.map((s) => {
      const meta = getChainMeta(s.key)
      return {
        key: s.key,
        label: meta?.name || s.key,
        value: s.value,
        percentage: (s.value / totalValue) * 100,
        color: getChainColor(s.key) || "#86868B",
        hasIcon: !!meta,
      }
    })
  }, [locations, totalValue])

  if (segments.length === 0) return null

  // Show ALL chains on the bar — each gets a distinct colored segment
  const barSegments = segments
  const legendSegments = segments

  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      {/* Header */}
      <p className="text-xs font-medium text-foreground-muted mb-4">
        Allocation
      </p>

      {/* Allocation bar — flex-grow proportional to value, minWidth for visibility */}
      <div
        className="flex w-full overflow-hidden mb-5"
        style={{
          height: 14,
          borderRadius: 7,
          gap: 1,
          backgroundColor: "var(--card-elevated)",
        }}
      >
        {barSegments.map((seg, i) => (
          <div
            key={seg.key}
            className="relative group"
            style={{
              flex: `${seg.value} 0 0px`,
              minWidth: 3,
              background: `linear-gradient(180deg, ${hexToRgba(seg.color, 1)} 0%, ${hexToRgba(seg.color, 0.75)} 100%)`,
              borderRadius:
                i === 0 && i === barSegments.length - 1
                  ? 7
                  : i === 0
                    ? "7px 0 0 7px"
                    : i === barSegments.length - 1
                      ? "0 7px 7px 0"
                      : 0,
              boxShadow: `inset 0 1px 0 ${hexToRgba(seg.color, 0.4)}`,
              transition: "flex 0.3s ease, filter 0.15s ease",
              cursor: "default",
            }}
            title={isHidden ? seg.label : `${seg.label}: ${formatFiatValue(seg.value)} (${seg.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Legend — responsive wrapping rows */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {legendSegments.map((seg) => (
          <div
            key={seg.key}
            className="flex items-center gap-2"
            style={{ minWidth: 0 }}
          >
            {/* Color dot or icon */}
            <div className="flex-shrink-0 w-4 flex items-center justify-center">
              {seg.hasIcon ? (
                <ChainIcon chainId={seg.key} size={16} />
              ) : (
                <div
                  className="rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: hexToRgba(seg.color, 0.25),
                    border: `1.5px solid ${hexToRgba(seg.color, 0.5)}`,
                  }}
                />
              )}
            </div>

            {/* Name */}
            <span className="text-foreground whitespace-nowrap font-data text-[11px] font-medium">
              {seg.label}
            </span>

            {/* Value */}
            <BlurredValue isHidden={!!isHidden}>
              <span className="text-foreground-muted whitespace-nowrap font-data text-[11px] tabular-nums">
                {formatFiatValue(seg.value)}
              </span>
            </BlurredValue>

            {/* Percentage */}
            <span
              className="whitespace-nowrap font-data text-[10px] tabular-nums"
              style={{
                color: seg.percentage >= 1 ? hexToRgba(seg.color, 0.8) : "var(--foreground-muted)",
              }}
            >
              {seg.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
