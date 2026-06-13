"use client"

import Link from "next/link"
import { TextMorph } from "torph/react"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  change?: { value: string; positive: boolean }
  icon: string
  isLoading?: boolean
  accentColor?: string
  isHidden?: boolean
  className?: string
  /** When set, the whole card becomes a link to this route (drill-through). */
  href?: string
}

export function FinanceStatCard({
  label,
  value,
  change,
  icon,
  isLoading,
  accentColor,
  isHidden,
  className,
  href,
}: StatCardProps) {
  const cardClassName = cn(
    "block p-5 transition-colors duration-300 group rounded-xl min-h-[126px] border border-transparent card-hover-lift",
    className,
  )
  const cardStyle = { boxShadow: "var(--shadow-sm)", background: "var(--card)" }
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          {label}
        </span>
        <span
          className="material-symbols-rounded text-lg"
          style={{ color: accentColor || "var(--foreground-muted)" }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      {isLoading ? (
        <div className="h-8 animate-shimmer w-32 rounded-lg" />
      ) : (
        <>
          <BlurredValue isHidden={!!isHidden}>
            <TextMorph
              className="text-foreground font-data"
              style={{
                fontSize: "clamp(18px, 2.5vw, 24px)",
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
        </>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cardClassName} style={cardStyle}>
        {inner}
      </Link>
    )
  }
  return (
    <div className={cardClassName} style={cardStyle}>
      {inner}
    </div>
  )
}
