"use client"

import { useState, ReactNode } from "react"
import { cn } from "@/lib/utils"

type CollapsibleSectionProps = {
  title: string
  icon?: string
  badge?: string | number
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
  className,
  headerClassName,
  contentClassName,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn("border border-card-border bg-card", className)}>
      {/* Header - clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full p-4 flex items-center justify-between",
          "hover:bg-background/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
          headerClassName
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className="material-symbols-rounded text-foreground-muted">
              {icon}
            </span>
          )}
          <h3 className="text-sm font-semibold tracking-tight text-left">
            {title}
          </h3>
          {badge !== undefined && (
            <span className="badge border-primary/30 text-primary text-xs">
              {badge}
            </span>
          )}
        </div>

        {/* Chevron indicator */}
        <span
          className={cn(
            "material-symbols-rounded text-foreground-muted transition-transform",
            isOpen && "rotate-180"
          )}
        >
          expand_more
        </span>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div
          className={cn(
            "p-4 pt-0 border-t border-card-border animate-in slide-in-from-top-2",
            contentClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
