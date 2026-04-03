import { cn } from "@/lib/utils"

type StatCardVariant = "default" | "success" | "warning" | "error" | "info"

type StatCardProps = {
  label: string
  value: string | number
  symbol?: string
  icon?: string
  variant?: StatCardVariant
  percentage?: number
  highlight?: boolean
  className?: string
}

const variantStyles: Record<StatCardVariant, string> = {
  default: "border-card-border",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  error: "border-error/30 bg-error/5",
  info: "border-info/30 bg-info/5",
}

const iconColors: Record<StatCardVariant, string> = {
  default: "text-foreground-muted",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
}

export function StatCard({
  label,
  value,
  symbol,
  icon,
  variant = "default",
  percentage,
  highlight = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "p-4 bg-background border transition-colors",
        variantStyles[variant],
        highlight && "ring-2 ring-primary",
        className
      )}
    >
      {/* Header with icon and label */}
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <span className={cn("material-symbols-rounded text-sm", iconColors[variant])}>
            {icon}
          </span>
        )}
        <p className="text-xs uppercase tracking-wider text-foreground-muted">
          {label}
        </p>
      </div>

      {/* Value display */}
      <div className="flex items-baseline gap-2">
        <p className="font-mono text-xl sm:text-2xl break-all">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {symbol && (
          <span className="font-mono text-sm sm:text-base text-foreground-muted">
            {symbol}
          </span>
        )}
      </div>

      {/* Optional percentage indicator */}
      {percentage !== undefined && (
        <div className="mt-2">
          <div className="h-1 bg-card-border overflow-hidden">
            <div
              className={cn(
                "h-full transition-colors",
                variant === "success" && "bg-success",
                variant === "warning" && "bg-warning",
                variant === "error" && "bg-error",
                variant === "info" && "bg-info",
                variant === "default" && "bg-foreground-muted"
              )}
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            {percentage.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  )
}
