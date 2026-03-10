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

const variantStyles: Record<InsightVariant, { bg: string; text: string; iconBg: string }> = {
  info: {
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-500/10",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-500/10",
  },
  success: {
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/10",
  },
  danger: {
    bg: "bg-red-50 border-red-200 dark:bg-red-500/5 dark:border-red-500/20",
    text: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-500/10",
  },
}

export function InsightCard({
  icon,
  title,
  description,
  variant = "info",
  actionLink,
  className,
}: InsightCardProps) {
  const styles = variantStyles[variant]

  return (
    <div className={cn("border rounded-xl p-4 flex gap-3", styles.bg, className)}>
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          styles.iconBg
        )}
      >
        <span className={cn("material-symbols-rounded", styles.text)} style={{ fontSize: 20 }}>
          {icon}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{description}</p>
        {actionLink && (
          <Link
            href={actionLink.href}
            className={cn("inline-block mt-2 text-xs font-medium transition-colors", styles.text)}
          >
            {actionLink.label} →
          </Link>
        )}
      </div>
    </div>
  )
}
