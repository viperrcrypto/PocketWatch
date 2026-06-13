"use client"

import { TextMorph } from "torph/react"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { BorderBeam } from "@/components/ui/border-beam"

export interface OverviewStatCardProps {
  label: string
  value: string
  change?: { value: string; positive: boolean }
  icon: string
  isLoading?: boolean
  accentColor?: string
  isHidden?: boolean
  /** Render an accent border-beam around the card (headline emphasis). */
  beam?: boolean
}

export function OverviewStatCard({
  label,
  value,
  change,
  icon,
  isLoading,
  accentColor,
  isHidden,
  beam = false,
}: OverviewStatCardProps) {
  const borderColor = accentColor || "#2a2a2a"
  return (
    <div
      className="relative bg-card border border-card-border p-5 hover:border-card-border-hover transition-colors duration-300 group rounded-xl"
      style={{ borderLeft: `2px solid ${borderColor}` }}
    >
      {beam && <BorderBeam radius={12} size={1.5} speed={7} />}
      <div className="flex items-center justify-between mb-4">
        <span className="text-foreground-muted text-xs font-semibold tracking-wider">
          {label}
        </span>
        <div className="flex items-center justify-center w-9 h-9 bg-background border border-card-border group-hover:border-card-border-hover transition-colors rounded-lg">
          <span
            className="material-symbols-rounded text-lg text-foreground-muted group-hover:text-foreground-secondary transition-colors"
            aria-hidden="true"
          >
            {icon}
          </span>
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 animate-shimmer w-32 rounded-lg" />
      ) : (
        <>
          <BlurredValue isHidden={!!isHidden}>
            <TextMorph
              className="text-foreground font-data"
              style={{
                fontSize: 20,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.03em",
              }}
              duration={500}
              ease="cubic-bezier(0.19, 1, 0.22, 1)"
            >
              {value}
            </TextMorph>
          </BlurredValue>
          {change && !isHidden && (
            <div
              className={`flex items-center gap-1.5 mt-2 ${change.positive ? "text-success" : "text-error"}`}
            >
              <span className="material-symbols-rounded text-sm">
                {change.positive ? "arrow_upward" : "arrow_downward"}
              </span>
              <TextMorph
                className="font-data"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
                duration={400}
                ease="cubic-bezier(0.19, 1, 0.22, 1)"
              >
                {change.value}
              </TextMorph>
            </div>
          )}
        </>
      )}
    </div>
  )
}
