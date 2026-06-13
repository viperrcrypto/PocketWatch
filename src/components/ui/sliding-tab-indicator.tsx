"use client"

import { motion, useReducedMotion } from "motion/react"
import { indicatorSpring } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: React.ReactNode
}

interface SlidingTabIndicatorProps {
  tabs: readonly Tab[]
  /** Currently active tab id. */
  active: string
  onChange: (id: string) => void
  className?: string
  /** Per-tab button className. */
  tabClassName?: string
  /** Shared layout id — make unique if multiple instances coexist. */
  layoutId?: string
  /** Accessible name for the tablist. */
  ariaLabel?: string
}

/**
 * Pill tab bar where a single highlight pill slides to the active tab via
 * motion's shared layout animation (transform only — no width/left jank).
 * Reduced-motion drops the slide; the pill simply snaps to the active tab.
 *
 * @example
 * <SlidingTabIndicator tabs={tabs} active={tab} onChange={setTab} />
 */
export function SlidingTabIndicator({
  tabs,
  active,
  onChange,
  className,
  tabClassName,
  layoutId = "sliding-tab-indicator",
  ariaLabel,
}: SlidingTabIndicatorProps) {
  const reduce = useReducedMotion()

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--card)] p-1",
        className
      )}
    >
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative z-10 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "text-[var(--foreground)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground-secondary)]",
              tabClassName
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-[var(--radius-sm)] bg-[var(--card-elevated)] shadow-sm"
                transition={reduce ? { duration: 0 } : indicatorSpring}
              />
            )}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
