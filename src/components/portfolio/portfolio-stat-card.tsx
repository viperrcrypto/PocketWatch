"use client"

import { cn } from "@/lib/utils"

interface PortfolioStatCardProps {
  label: string
  value: string
  change?: { value: string; positive: boolean }
  icon?: string
  isLoading?: boolean
  onClick?: () => void
  className?: string
}

export function PortfolioStatCard({ label, value, change, icon, isLoading, onClick, className }: PortfolioStatCardProps) {
  const isLongValue = value.length > 10
  const isVeryLongValue = value.length > 13

  if (isLoading) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-4 min-w-0 min-h-[126px]">
        <div className="h-3 w-20 bg-card-elevated rounded animate-pulse mb-3" />
        <div className="h-7 w-32 bg-card-elevated rounded animate-pulse mb-2" />
        <div className="h-3 w-16 bg-card-elevated rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div
      className={cn("bg-card border border-card-border rounded-xl p-4 min-w-0 min-h-[126px] flex flex-col overflow-hidden", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
    >
      {/* Label */}
      <div className="flex items-start gap-2 mb-2 min-h-[2rem]">
        {icon && (
          <span className="material-symbols-rounded text-sm text-foreground-muted mt-0.5" aria-hidden="true">
            {icon}
          </span>
        )}
        <p className="text-[11px] leading-tight font-medium text-foreground-muted overflow-hidden">
          {label}
        </p>
      </div>

      {/* Value */}
      <p className={cn(
        "block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-data leading-tight tracking-tight text-foreground tabular-nums",
        isVeryLongValue
          ? "text-[clamp(0.85rem,0.95vw,1.15rem)]"
          : isLongValue
            ? "text-[clamp(0.95rem,1.1vw,1.4rem)]"
            : "text-[clamp(1.15rem,1.4vw,1.85rem)]"
      )}>
        {value}
      </p>

      {/* Change */}
      {change && (
        <div className={cn(
          "flex items-center gap-1 mt-1 font-data text-xs whitespace-nowrap min-h-[1rem]",
          change.positive ? "text-success" : "text-error"
        )}>
          <span className="material-symbols-rounded text-xs" aria-hidden="true">
            {change.positive ? "arrow_upward" : "arrow_downward"}
          </span>
          <span className="tabular-nums truncate">{change.value}</span>
        </div>
      )}
    </div>
  )
}
