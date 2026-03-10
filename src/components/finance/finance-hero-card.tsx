"use client"

import { type ReactNode } from "react"
import { TextMorph } from "torph/react"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { cn } from "@/lib/utils"

interface FooterStat {
  label: string
  value: string
  color?: string // "success" | "error" | etc.
}

interface FinanceHeroCardProps {
  label: string
  value: string
  change?: { value: string; positive: boolean }
  footerStats?: FooterStat[]
  isLoading?: boolean
  isHidden?: boolean
  children?: ReactNode // slot for chart or extra content
  className?: string
}

export function FinanceHeroCard({
  label,
  value,
  change,
  footerStats,
  isLoading,
  isHidden,
  children,
  className,
}: FinanceHeroCardProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-white via-white to-primary/[0.02] rounded-xl overflow-hidden",
        "dark:from-[#1C1C21] dark:via-[#1C1C21] dark:to-primary/[0.02]",
        className
      )}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="p-6">
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          {label}
        </span>

        {isLoading ? (
          <div className="h-12 animate-shimmer w-48 rounded-lg mt-2" />
        ) : (
          <div className="mt-2">
            <BlurredValue isHidden={!!isHidden}>
              <TextMorph
                className="text-foreground font-data"
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
                duration={500}
                ease="cubic-bezier(0.19, 1, 0.22, 1)"
              >
                {value}
              </TextMorph>
            </BlurredValue>

            {change && !isHidden && (
              <div className="mt-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium",
                    change.positive
                      ? "bg-success/10 text-success"
                      : "bg-error/10 text-error"
                  )}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
                    {change.positive ? "arrow_upward" : "arrow_downward"}
                  </span>
                  {change.value}
                </span>
              </div>
            )}
          </div>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>

      {footerStats && footerStats.length > 0 && (
        <div
          className="grid divide-x divide-card-border/15 border-t border-card-border/30"
          style={{
            gridTemplateColumns: `repeat(${footerStats.length}, minmax(0, 1fr))`,
            backgroundColor: "color-mix(in srgb, var(--background-secondary) 40%, transparent)",
          }}
        >
          {footerStats.map((stat) => (
            <div key={stat.label} className="px-4 py-3 text-center hover:bg-primary-subtle transition-colors">
              <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1">
                {stat.label}
              </p>
              <p
                className={cn(
                  "font-data text-sm font-semibold tabular-nums",
                  stat.color === "success" && "text-success",
                  stat.color === "error" && "text-error",
                  !stat.color && "text-foreground"
                )}
              >
                <BlurredValue isHidden={!!isHidden}>{stat.value}</BlurredValue>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
