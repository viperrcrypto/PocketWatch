"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

type InsightVariant = "info" | "warning" | "success" | "danger"

interface InsightCardProps {
  icon: string
  title: string
  description: string
  variant?: InsightVariant
  actionLink?: { label: string; href: string }
  className?: string
}

const variantColors: Record<InsightVariant, string> = {
  info: "var(--primary)",
  warning: "var(--warning)",
  success: "var(--success)",
  danger: "var(--error)",
}

export function InsightCard({
  icon,
  title,
  description,
  variant = "info",
  actionLink,
  className,
}: InsightCardProps) {
  const color = variantColors[variant]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card border border-card-border p-4 flex gap-3",
        "transition-colors duration-200",
        className
      )}
    >
      <span
        className="material-symbols-rounded flex-shrink-0"
        style={{ fontSize: 20, color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{description}</p>
        {actionLink && (
          <Link
            href={actionLink.href}
            className="inline-block mt-2 text-xs font-medium transition-colors"
            style={{ color }}
          >
            {actionLink.label} &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}
