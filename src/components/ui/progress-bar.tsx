import { cn } from "@/lib/utils"

/**
 * Unified Progress Bar Design System
 *
 * Heights are significantly increased for better visibility:
 * - sm: 20px (compact contexts like tables)
 * - md: 32px (standard contexts like cards)
 * - lg: 48px (featured contexts like hero sections)
 *
 * All variants use:
 * - 2px solid borders for prominence
 * - Sharp edges (border-radius: 0) - brutalist
 * - High contrast text on colored fills
 */

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "success" | "warning" | "error" | "muted"
  showLabel?: boolean
  label?: string
  className?: string
}

const sizeConfig = {
  sm: "h-5",   // 20px - compact (tables, inline)
  md: "h-8",   // 32px - standard (cards, forms)
  lg: "h-12",  // 48px - featured (hero, emphasis)
}

const variantConfig = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  muted: "bg-foreground-muted",
}

function formatPercentage(pct: number) {
  if (pct === 0) return "0%"
  if (pct < 0.1) return "< 0.1%"
  if (pct < 1) return pct.toFixed(2) + "%"
  if (pct < 10) return pct.toFixed(1) + "%"
  return pct.toFixed(0) + "%"
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

export function ProgressBar({
  value,
  max = 100,
  size = "md",
  variant = "primary",
  showLabel = false,
  label,
  className,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0

  // Format label text
  const labelText = label || `${percentage.toFixed(percentage < 1 && percentage > 0 ? 2 : percentage < 10 ? 1 : 0)}%`

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs uppercase tracking-wider text-foreground-muted font-semibold">
            Progress
          </span>
          <span className="text-sm font-mono text-foreground font-semibold">
            {labelText}
          </span>
        </div>
      )}
      <div className={cn(
        "w-full bg-background border-2 border-card-border overflow-hidden",
        sizeConfig[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            variantConfig[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Compact progress bar with inline label (for tables and inline displays)
interface CompactProgressProps {
  value: number
  max: number
  currency?: string
  size?: "sm" | "md"
  variant?: "primary" | "success" | "warning" | "error" | "muted"
}

export function CompactProgress({
  value,
  max,
  currency,
  size = "sm",
  variant = "success",
}: CompactProgressProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "flex-1 bg-background border-2 border-card-border overflow-hidden max-w-[140px]",
        sizeConfig[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            variantConfig[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-mono text-foreground whitespace-nowrap font-semibold">
        {formatPercentage(percentage)}
      </span>
    </div>
  )
}

// Enhanced progress for contribution forms (hero/featured contexts)
interface EnhancedProgressProps {
  allocated: number
  contributed: number
  remaining: number
  currency: string
}

export function EnhancedProgress({
  allocated,
  contributed,
  remaining,
  currency,
}: EnhancedProgressProps) {
  const percentage = allocated > 0 ? (contributed / allocated) * 100 : 0

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="text-center p-4 border-2 border-card-border bg-card-elevated">
          <p className="text-xs uppercase tracking-wider text-foreground-muted mb-2 font-semibold">
            Allocated
          </p>
          <p className="font-mono text-2xl font-bold">
            {formatNumber(allocated)}
          </p>
          <p className="text-xs text-foreground-muted mt-1">{currency}</p>
        </div>
        <div className="text-center p-4 border-2 border-success/40 bg-success/10">
          <p className="text-xs uppercase tracking-wider text-success mb-2 font-semibold">
            Contributed
          </p>
          <p className="font-mono text-2xl font-bold text-success">
            {formatNumber(contributed)}
          </p>
          <p className="text-xs text-success/80 mt-1">{currency}</p>
        </div>
        <div className="text-center p-4 border-2 border-primary/40 bg-primary/10">
          <p className="text-xs uppercase tracking-wider text-primary mb-2 font-semibold">
            Remaining
          </p>
          <p className="font-mono text-2xl font-bold text-primary">
            {formatNumber(remaining)}
          </p>
          <p className="text-xs text-primary/80 mt-1">{currency}</p>
        </div>
      </div>

      <div className="relative">
        {/* Use lg size (h-12 = 48px) for maximum prominence */}
        <div className="h-12 bg-background border-2 border-card-border overflow-hidden relative">
          <div
            className="h-full bg-success transition-all duration-500 ease-out relative"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          >
            {/* Show percentage inside bar when there's enough space */}
            {percentage > 20 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-mono font-bold text-background">
                  {formatPercentage(percentage)}
                </span>
              </div>
            )}
          </div>
          {/* Show percentage outside if bar too small */}
          {percentage <= 20 && percentage > 0 && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <span className="text-sm font-mono font-bold text-foreground">
                {formatPercentage(percentage)}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="text-xs text-foreground-muted uppercase tracking-wider font-semibold">
            Contribution Progress
          </span>
          <span className="text-sm font-mono text-foreground font-semibold">
            {formatNumber(contributed)} / {formatNumber(allocated)} {currency}
          </span>
        </div>
      </div>
    </div>
  )
}

// Progress bar with values displayed (for deal campaigns and cards)
interface DetailedProgressProps {
  current: number
  target: number
  currency?: string
  size?: "md" | "lg"
  variant?: "primary" | "success" | "warning" | "error"
  label?: string
}

export function DetailedProgress({
  current,
  target,
  currency = "USDC",
  size = "md",
  variant = "success",
  label = "Progress",
}: DetailedProgressProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0

  // Text size based on bar size
  const textSize = size === "lg" ? "text-base" : "text-sm"

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs uppercase tracking-wider text-foreground-muted font-semibold">
          {label}
        </span>
        <span className="text-sm font-mono text-foreground font-semibold">
          {formatNumber(current)} / {formatNumber(target)} {currency}
        </span>
      </div>
      <div className={cn(
        "w-full bg-background border-2 border-card-border overflow-hidden relative",
        sizeConfig[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out relative",
            variantConfig[variant]
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Show percentage inside bar when there's enough space (>20%) */}
          {percentage > 20 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(textSize, "font-mono font-bold text-background")}>
                {formatPercentage(percentage)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-foreground-muted uppercase tracking-wider font-semibold">
          {percentage > 100 ? "Oversubscribed" : "Target"}
        </span>
        {percentage <= 20 && (
          <span className="text-xs font-mono text-foreground font-semibold">
            {formatPercentage(percentage)}
          </span>
        )}
      </div>
    </div>
  )
}
