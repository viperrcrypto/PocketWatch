import { cn } from "@/lib/utils"
import { ReactNode } from "react"

type EmptyStateProps = {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  variant?: "default" | "info" | "warning" | "error"
  className?: string
  children?: ReactNode
}

const variantStyles = {
  default: {
    icon: "text-foreground-muted",
    border: "border-card-border",
    bg: "bg-card",
  },
  info: {
    icon: "text-info",
    border: "border-info/30",
    bg: "bg-info/5",
  },
  warning: {
    icon: "text-warning",
    border: "border-warning/30",
    bg: "bg-warning/5",
  },
  error: {
    icon: "text-error",
    border: "border-error/30",
    bg: "bg-error/5",
  },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
  children,
}: EmptyStateProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "card p-12 text-center border",
        styles.border,
        styles.bg,
        className
      )}
    >
      <span
        className={cn(
          "material-symbols-rounded text-5xl mb-4 block",
          styles.icon
        )}
      >
        {icon}
      </span>

      <h3 className="font-semibold text-xl tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-foreground-muted max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>

      {action && (
        <>
          {action.href ? (
            <a
              href={action.href}
              className="btn-primary inline-block"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="btn-primary"
            >
              {action.label}
            </button>
          )}
        </>
      )}

      {children}
    </div>
  )
}
